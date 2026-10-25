import { safeHref } from '@texuli/core/url-policy';
import { parseEditOps } from '../edit/parse.ts';
import type { CatalogTreeInput } from '../render/renderer/types.ts';
import {
  type BlueprintEnvelope,
  ENVELOPE_FORMAT,
  ENVELOPE_STATUSES,
  ENVELOPE_VERSION,
  type EnvelopeIssue,
  SUPPORTED_ENVELOPE_VERSIONS,
} from './types.ts';

/** Most provenance entries an envelope keeps (the oldest are dropped). */
export const MAX_PROVENANCE = 500;
/** Most sources an envelope may name. */
export const MAX_SOURCES = 32;
/** Longest display string in the envelope fields. */
export const MAX_ENVELOPE_TEXT = 512;

const ID = /^[A-Za-z0-9._:-]{1,128}$/;
const HASH = /^[0-9a-f]{64}$/;
const ISO_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/;
/** C0/C1 controls (except tab and newline), bidi overrides and isolates. */
function hasUnsafeChar(value: string): boolean {
  for (const char of value) {
    const code = char.codePointAt(0) ?? 0;
    if (
      (code < 0x20 && code !== 0x09 && code !== 0x0a) ||
      (code >= 0x7f && code <= 0x9f) ||
      (code >= 0x202a && code <= 0x202e) ||
      (code >= 0x2066 && code <= 0x2069)
    ) {
      return true;
    }
  }
  return false;
}

const FIELDS: Readonly<Record<string, readonly string[]>> = {
  $: [
    'format',
    'version',
    'id',
    'catalog',
    'status',
    'createdAt',
    'updatedAt',
    'generator',
    'tier',
    'profile',
    'asOf',
    'sources',
    'trigger',
    'meetingRef',
    'activatedBy',
    'provenance',
    'tree',
  ],
  generator: ['kind', 'name', 'model'],
  source: ['label', 'href'],
  trigger: ['kind', 'label'],
  meetingRef: ['id', 'title', 'startsAt'],
  activatedBy: ['by', 'at', 'digest'],
  provenance: ['at', 'actor', 'kind', 'ops'],
};

export interface ParseEnvelopeOptions {
  /** The catalog hash the host pinned; a different `catalog` is an error. */
  catalogHash?: string;
}

export interface ParseEnvelopeResult {
  /** `null` when the envelope cannot be read at all (version, tree). */
  envelope: BlueprintEnvelope | null;
  issues: readonly EnvelopeIssue[];
}

/** Whether `value` claims to be an envelope (it has the format tag). */
export function isEnvelopeLike(value: unknown): value is Record<string, unknown> {
  return (
    value !== null &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    (value as Record<string, unknown>).format === ENVELOPE_FORMAT
  );
}

/**
 * Read an untrusted envelope's fields strictly: unknown fields, bad ids,
 * times, URLs and text are errors. The tree is returned as is; its checks
 * are `validateDraft`'s. Never throws.
 */
export function parseEnvelope(
  value: Record<string, unknown>,
  options: ParseEnvelopeOptions = {}
): ParseEnvelopeResult {
  const issues: EnvelopeIssue[] = [];
  const error = (code: string, path: string, message: string) => {
    issues.push({ code, path, message, severity: 'error' });
  };
  const record = (input: unknown, kind: string, path: string): Record<string, unknown> | null => {
    if (input === null || typeof input !== 'object' || Array.isArray(input)) {
      error('invalid-field', path, `"${path}" must be an object.`);
      return null;
    }
    const allowed = FIELDS[kind] ?? [];
    for (const key of Object.keys(input)) {
      if (!allowed.includes(key)) {
        error(
          key === '__proto__' || key === 'constructor' || key === 'prototype'
            ? 'prototype-key'
            : 'unknown-field',
          `${path}.${key}`,
          `"${key}" is not an envelope field.`
        );
      }
    }
    return input as Record<string, unknown>;
  };
  const text = (input: unknown, path: string, optional = false): void => {
    if (input === undefined && optional) return;
    if (typeof input !== 'string' || input.length === 0 || input.length > MAX_ENVELOPE_TEXT) {
      error('invalid-text', path, `"${path}" must be 1–${MAX_ENVELOPE_TEXT} characters.`);
    } else if (hasUnsafeChar(input)) {
      error('invalid-text', path, `"${path}" contains control or bidi characters.`);
    }
  };
  const time = (input: unknown, path: string, optional = false): void => {
    if (input === undefined && optional) return;
    if (typeof input !== 'string' || !ISO_TIME.test(input) || !Number.isFinite(Date.parse(input))) {
      error('invalid-time', path, `"${path}" must be an ISO 8601 time with a zone.`);
    }
  };
  const oneOf = (input: unknown, values: readonly string[], path: string, optional = false) => {
    if (input === undefined && optional) return;
    if (typeof input !== 'string' || !values.includes(input)) {
      error('invalid-field', path, `"${path}" must be one of ${values.join(', ')}.`);
    }
  };

  const root = record(value, '$', '$');
  if (root === null) return { envelope: null, issues };
  if (root.version === undefined) {
    error(
      'invalid-version',
      '$.version',
      'The envelope has no "version". Add "version": 1, or migrate the record with migrateEnvelope.'
    );
    return { envelope: null, issues };
  }
  if (root.version !== ENVELOPE_VERSION) {
    error(
      'unsupported-version',
      '$.version',
      `Envelope version ${JSON.stringify(root.version)} is not supported; this package reads version ${SUPPORTED_ENVELOPE_VERSIONS.join(', ')}.`
    );
    return { envelope: null, issues };
  }
  const tree = root.tree;
  if (tree === null || typeof tree !== 'object' || Array.isArray(tree)) {
    error('missing-tree', '$.tree', 'The envelope needs a "tree": one catalog root node.');
    return { envelope: null, issues };
  }

  if (typeof root.id !== 'string' || !ID.test(root.id)) {
    error('invalid-id', '$.id', '"id" must be 1–128 letters, digits, ".", "_", ":" or "-".');
  }
  if (typeof root.catalog !== 'string' || !HASH.test(root.catalog)) {
    error('invalid-catalog', '$.catalog', '"catalog" must be a catalog build hash (64 hex).');
  } else if (options.catalogHash !== undefined && root.catalog !== options.catalogHash) {
    error(
      'catalog-mismatch',
      '$.catalog',
      `The draft was written for catalog ${root.catalog.slice(0, 12)}…, not the pinned ${options.catalogHash.slice(0, 12)}….`
    );
  }
  oneOf(root.status, ENVELOPE_STATUSES, '$.status');
  time(root.createdAt, '$.createdAt');
  time(root.updatedAt, '$.updatedAt');
  time(root.asOf, '$.asOf', true);
  oneOf(root.tier, ['developer', 'untrusted'], '$.tier', true);
  oneOf(root.profile, ['web', 'portable'], '$.profile', true);
  if (root.profile === 'portable') {
    // ADR-004: no id is audited portable yet, so a portable profile fails closed.
    error(
      'unsupported-profile',
      '$.profile',
      'No catalog id is declared portable yet; use the "web" profile.'
    );
  }

  const generator = record(root.generator, 'generator', '$.generator');
  if (generator) {
    oneOf(generator.kind, ['agent', 'person', 'tool'], '$.generator.kind');
    text(generator.name, '$.generator.name');
    text(generator.model, '$.generator.model', true);
  }
  if (root.sources !== undefined) {
    if (!Array.isArray(root.sources) || root.sources.length > MAX_SOURCES) {
      error('invalid-field', '$.sources', `"sources" must be a list of at most ${MAX_SOURCES}.`);
    } else {
      root.sources.forEach((item, index) => {
        const path = `$.sources[${index}]`;
        const source = record(item, 'source', path);
        if (!source) return;
        text(source.label, `${path}.label`);
        if (source.href !== undefined && safeHref(source.href, 'untrusted') === undefined) {
          error('unsafe-url', `${path}.href`, 'The untrusted URL policy refuses this source link.');
        }
      });
    }
  }
  if (root.trigger !== undefined) {
    const trigger = record(root.trigger, 'trigger', '$.trigger');
    if (trigger) {
      oneOf(trigger.kind, ['request', 'schedule', 'calendar', 'event'], '$.trigger.kind');
      text(trigger.label, '$.trigger.label');
    }
  }
  if (root.meetingRef !== undefined) {
    const meeting = record(root.meetingRef, 'meetingRef', '$.meetingRef');
    if (meeting) {
      if (typeof meeting.id !== 'string' || !ID.test(meeting.id)) {
        error('invalid-id', '$.meetingRef.id', '"meetingRef.id" must be a short id.');
      }
      text(meeting.title, '$.meetingRef.title', true);
      time(meeting.startsAt, '$.meetingRef.startsAt', true);
    }
  }
  if (root.activatedBy !== undefined) {
    const activation = record(root.activatedBy, 'activatedBy', '$.activatedBy');
    if (activation) {
      text(activation.by, '$.activatedBy.by');
      time(activation.at, '$.activatedBy.at');
      if (typeof activation.digest !== 'string' || !HASH.test(activation.digest)) {
        error('invalid-field', '$.activatedBy.digest', '"digest" must be a SHA-256 (64 hex).');
      }
    }
  }
  if (root.provenance !== undefined) {
    if (!Array.isArray(root.provenance) || root.provenance.length > MAX_PROVENANCE) {
      error(
        'invalid-field',
        '$.provenance',
        `"provenance" must be a list of at most ${MAX_PROVENANCE} entries.`
      );
    } else {
      root.provenance.forEach((item, index) => {
        const path = `$.provenance[${index}]`;
        const entry = record(item, 'provenance', path);
        if (!entry) return;
        time(entry.at, `${path}.at`);
        text(entry.actor, `${path}.actor`);
        oneOf(entry.kind, ['apply', 'undo', 'redo'], `${path}.kind`);
        const ops = parseEditOps(entry.ops);
        if (!ops.ok) error('invalid-ops', `${path}.ops`, ops.error.message);
      });
    }
  }

  return {
    envelope: { ...(root as unknown as BlueprintEnvelope), tree: tree as CatalogTreeInput },
    issues,
  };
}
