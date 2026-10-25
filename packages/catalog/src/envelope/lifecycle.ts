import { blueprintDigest } from '../edit/digest.ts';
import type { EditEvent, EditHistory } from '../edit/history.ts';
import type { CatalogTreeInput } from '../render/renderer/types.ts';
import type { DraftValidation } from '../validate/draft.ts';
import { isEnvelopeLike, MAX_PROVENANCE } from './parse.ts';
import {
  type BlueprintEnvelope,
  ENVELOPE_FORMAT,
  ENVELOPE_VERSION,
  type EnvelopeGenerator,
  SUPPORTED_ENVELOPE_VERSIONS,
} from './types.ts';

const now = (): string => new Date().toISOString();

export interface CreateEnvelopeInput {
  id: string;
  /** The catalog build hash the tree is written against. */
  catalog: string;
  generator: EnvelopeGenerator;
  tree: CatalogTreeInput;
  /** Defaults to the current time. */
  at?: string;
  extra?: Partial<
    Pick<BlueprintEnvelope, 'tier' | 'profile' | 'asOf' | 'sources' | 'trigger' | 'meetingRef'>
  >;
}

/** A new `draft` envelope. Every envelope starts as a draft. */
export function createEnvelope(input: CreateEnvelopeInput): BlueprintEnvelope {
  const at = input.at ?? now();
  return {
    format: ENVELOPE_FORMAT,
    version: ENVELOPE_VERSION,
    id: input.id,
    catalog: input.catalog,
    status: 'draft',
    createdAt: at,
    updatedAt: at,
    generator: input.generator,
    ...input.extra,
    tree: input.tree,
  };
}

export type LifecycleResult =
  | { ok: true; envelope: BlueprintEnvelope }
  | { ok: false; code: 'not-validated' | 'not-active' | 'digest-mismatch'; message: string };

/** Host-computed evidence for one validation transition; never an activation credential. */
export interface EnvelopeValidationReceipt {
  at: string;
  envelopeId: string;
  catalogHash: string;
  tier: DraftValidation['tier'];
  ok: boolean;
  validationStatus: DraftValidation['status'];
  checks: DraftValidation['checks'];
  errors: number;
  warnings: number;
}

/**
 * Capture the validation result that earned an envelope's current lifecycle
 * state. Parse failures without a decoded envelope have no state transition
 * and therefore no envelope receipt.
 */
export function createValidationReceipt(
  validation: DraftValidation,
  at = now()
): EnvelopeValidationReceipt | null {
  const envelope = validation.envelope;
  if (!envelope) return null;
  return {
    at,
    envelopeId: envelope.id,
    catalogHash: envelope.catalog,
    tier: validation.tier,
    ok: validation.ok,
    validationStatus: validation.status,
    checks: validation.checks,
    errors: validation.diagnostics.filter((diagnostic) => diagnostic.severity === 'error').length,
    warnings: validation.diagnostics.filter((diagnostic) => diagnostic.severity === 'warning')
      .length,
  };
}

/**
 * The owner's activation, called by the host's own activate control (never
 * by the player or the draft). It needs a `validated` envelope, as returned
 * by `validateDraft`, and the digest the owner reviewed: activating a tree
 * that changed since the review is refused.
 */
export async function activateEnvelope(
  envelope: BlueprintEnvelope,
  owner: { by: string; reviewedDigest: string; at?: string }
): Promise<LifecycleResult> {
  if (envelope.status !== 'validated') {
    return {
      ok: false,
      code: 'not-validated',
      message: `Only a validated draft can be activated (this one is ${envelope.status}).`,
    };
  }
  const digest = await blueprintDigest(envelope.tree);
  if (digest !== owner.reviewedDigest) {
    return {
      ok: false,
      code: 'digest-mismatch',
      message: 'The blueprint changed after the owner reviewed it.',
    };
  }
  const at = owner.at ?? now();
  return {
    ok: true,
    envelope: {
      ...envelope,
      status: 'active',
      updatedAt: at,
      activatedBy: { by: owner.by, at, digest },
    },
  };
}

/** Mark an active envelope superseded by a newer active version. */
export function supersedeEnvelope(envelope: BlueprintEnvelope, at = now()): LifecycleResult {
  if (envelope.status !== 'active') {
    return {
      ok: false,
      code: 'not-active',
      message: `Only an active blueprint can be superseded (this one is ${envelope.status}).`,
    };
  }
  return { ok: true, envelope: { ...envelope, status: 'superseded', updatedAt: at } };
}

/**
 * Whether an active envelope's tree is still the one the owner activated.
 * Hosts check their own stored activation record; this is the digest half.
 */
export async function verifyActivation(envelope: BlueprintEnvelope): Promise<boolean> {
  if (envelope.status !== 'active' || envelope.activatedBy === undefined) return false;
  return (await blueprintDigest(envelope.tree)) === envelope.activatedBy.digest;
}

export interface ProvenanceRecorder {
  /** The envelope with every edit so far. */
  envelope(): BlueprintEnvelope;
  /** Stop listening to the history. */
  stop(): void;
}

/**
 * Record a history's applies, undos and redos into an envelope: each step
 * appends `{ at, actor, kind, ops }` to `provenance` (the oldest beyond
 * `MAX_PROVENANCE` are dropped) and takes the new tree. Any edit makes the
 * envelope a `draft` again and drops its activation: an edited blueprint is
 * a new draft that needs validation and activation of its own.
 */
export function recordProvenance(
  history: EditHistory,
  envelope: BlueprintEnvelope,
  actor: string,
  clock: () => string = now
): ProvenanceRecorder {
  let current = envelope;
  const stop = history.subscribe((event: EditEvent) => {
    const at = clock();
    const provenance = [
      ...(current.provenance ?? []),
      { at, actor, kind: event.type, ops: event.ops },
    ].slice(-MAX_PROVENANCE);
    const { activatedBy: _dropped, ...rest } = current;
    current = { ...rest, status: 'draft', updatedAt: at, provenance, tree: event.tree };
  });
  return { envelope: () => current, stop };
}

export type MigrateResult =
  | { ok: true; envelope: BlueprintEnvelope; migrated: boolean }
  | {
      ok: false;
      code: 'unsupported-version' | 'invalid-version' | 'unknown-format' | 'not-a-tree';
      message: string;
    };

/**
 * Bring stored data to the current envelope version. A version 1 envelope
 * passes through; a bare catalog tree (the format before envelopes) is
 * wrapped as a `draft` with the given metadata. Everything else is refused
 * with an actionable code: a record that declares a different `format` is
 * never reinterpreted as a tree (`unknown-format`), an envelope-like record
 * without a `version` is `invalid-version`, and a newer version than
 * {@link SUPPORTED_ENVELOPE_VERSIONS} is `unsupported-version` — refused,
 * never guessed at. The result still needs `validateDraft`.
 */
export function migrateEnvelope(
  value: unknown,
  wrap: Omit<CreateEnvelopeInput, 'tree'>
): MigrateResult {
  if (isEnvelopeLike(value)) {
    if (value.version === ENVELOPE_VERSION) {
      return { ok: true, envelope: value as unknown as BlueprintEnvelope, migrated: false };
    }
    if (value.version === undefined) {
      return {
        ok: false,
        code: 'invalid-version',
        message: 'The envelope has no "version". Add "version": 1, or re-save the record.',
      };
    }
    return {
      ok: false,
      code: 'unsupported-version',
      message: `Envelope version ${JSON.stringify(value.version)} is not supported; this package reads version ${SUPPORTED_ENVELOPE_VERSIONS.join(', ')}.`,
    };
  }
  if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
    const format = (value as { format?: unknown }).format;
    if (format !== undefined) {
      return {
        ok: false,
        code: 'unknown-format',
        message: `The record declares "format" ${JSON.stringify(format)}, not ${JSON.stringify(ENVELOPE_FORMAT)}; only a Texuli blueprint envelope or a bare catalog tree migrates.`,
      };
    }
    if (typeof (value as { id?: unknown }).id === 'string') {
      return {
        ok: true,
        envelope: createEnvelope({ ...wrap, tree: value as CatalogTreeInput }),
        migrated: true,
      };
    }
  }
  return {
    ok: false,
    code: 'not-a-tree',
    message: 'Only an envelope or one catalog tree migrates.',
  };
}
