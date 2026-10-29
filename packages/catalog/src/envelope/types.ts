import { SPEC_MIGRATIONS } from '@texuli/spec/migrate';
import type { BlueprintEnvelopeMotion } from '@texuli/spec/motion';
import type { EditOp } from '../edit/types.ts';
import type { CatalogTreeInput, RenderTier } from '../render/renderer/types.ts';

/** The envelope format tag and the version this package writes. */
export const ENVELOPE_FORMAT = 'texuli-blueprint';
export const ENVELOPE_VERSION = 1;

/**
 * The envelope versions this package reads. Today that is only the version
 * it writes; if a later version still reads version 1, the list grows and
 * `migrateEnvelope` moves stored data up. A newer version than the last
 * entry is refused, never guessed at.
 */
export const SUPPORTED_ENVELOPE_VERSIONS = [ENVELOPE_VERSION] as const;

/**
 * The spec versions `parseEnvelope` accepts in an envelope's `spec`: every
 * target of the migration chain (`@texuli/spec/migrate`), today `0.3.0` and
 * `0.4.0`, the same enum as `blueprint.schema.json`. An envelope without
 * `spec` (written for the undeclared baseline, `0.2.0`) parses as is; one
 * that declares `"spec": "0.2.0"` is accepted only through migration:
 * `validateDraft` runs `migrateBlueprint` first, which stamps the current
 * version, while `parseEnvelope` alone refuses it (`unsupported-spec`).
 */
export const SUPPORTED_SPEC_VERSIONS: readonly string[] = Object.freeze(
  SPEC_MIGRATIONS.map((step) => step.to)
);

/**
 * Lifecycle: an agent or builder writes a `draft`; validation makes it
 * `validated`; only the host's owner flow makes it `active`; a newer active
 * version makes it `superseded`. A status read from untrusted input is
 * never trusted (see `validateDraft`).
 */
export const ENVELOPE_STATUSES = ['draft', 'validated', 'active', 'superseded'] as const;
export type EnvelopeStatus = (typeof ENVELOPE_STATUSES)[number];

/** ADR-004 capability profile. Nothing is audited portable yet. */
export type EnvelopeProfile = 'web' | 'portable';

/** Who or what produced the draft. Display data, never authority. */
export interface EnvelopeGenerator {
  kind: 'agent' | 'person' | 'tool';
  name: string;
  /** The model label, for an agent. */
  model?: string;
}

/** A source the data came from; `href` passes the untrusted URL policy. */
export interface EnvelopeSource {
  label: string;
  href?: string;
}

/** Why the draft exists (scenario 4: "calendar: 60 min before the meeting"). */
export interface EnvelopeTrigger {
  kind: 'request' | 'schedule' | 'calendar' | 'event';
  label: string;
}

/** The meeting a proactive draft was prepared for. */
export interface EnvelopeMeetingRef {
  id: string;
  title?: string;
  startsAt?: string;
}

/** The owner's activation of one immutable blueprint (digest). Host-written only. */
export interface EnvelopeActivation {
  by: string;
  at: string;
  /** `blueprintDigest(tree)` at activation. */
  digest: string;
}

/** One recorded edit step: who changed the tree, when, and with which ops. */
export interface ProvenanceEntry {
  at: string;
  actor: string;
  kind: 'apply' | 'undo' | 'redo';
  ops: readonly EditOp[];
}

/**
 * The versioned blueprint envelope (ADR-004, audit G13): a catalog tree with
 * its catalog binding, lifecycle status and provenance.
 */
export interface BlueprintEnvelope {
  format: typeof ENVELOPE_FORMAT;
  version: typeof ENVELOPE_VERSION;
  /** Stable draft id: 1–128 characters of letters, digits, `.`, `_`, `:` or `-`. */
  id: string;
  /** The catalog build hash (64 lowercase hex) the tree was written against. */
  catalog: string;
  status: EnvelopeStatus;
  createdAt: string;
  updatedAt: string;
  generator: EnvelopeGenerator;
  /** The emit tier the producer declares. The host chooses the tier it validates with. */
  tier?: RenderTier;
  /** Default `web`. */
  profile?: EnvelopeProfile;
  /** When the data was current. */
  asOf?: string;
  sources?: readonly EnvelopeSource[];
  trigger?: EnvelopeTrigger;
  meetingRef?: EnvelopeMeetingRef;
  activatedBy?: EnvelopeActivation;
  /** Oldest first; at most `MAX_PROVENANCE` entries are kept. */
  provenance?: readonly ProvenanceEntry[];
  /**
   * The spec version the envelope was written for (spec 0.3.0). Omitted
   * means 0.2.0; `validateDraft` migrates before parsing, so a validated
   * envelope always carries the current version.
   */
  spec?: string;
  /** Local state declarations (spec 0.3.0 `state`), checked by `@texuli/spec`. */
  state?: Readonly<Record<string, unknown>>;
  /** The declared flow of views (spec 0.3.0 `flow`), checked by `@texuli/spec`. */
  flow?: Readonly<Record<string, unknown>>;
  /**
   * The blueprint's motion level (spec 0.6.0 `motion`): `full`, `subtle` or
   * `none`. A host level and the reader's reduced-motion preference can only
   * lower it.
   */
  motion?: Readonly<BlueprintEnvelopeMotion>;
  tree: CatalogTreeInput;
}

/** A problem found in the envelope fields (the tree has its own checks). */
export interface EnvelopeIssue {
  code: string;
  path: string;
  message: string;
  severity: 'error' | 'warning';
}
