/**
 * `@texuli/catalog/envelope` — the versioned blueprint envelope (ADR-004,
 * audit G13): catalog binding, lifecycle status (draft → validated → active
 * → superseded, with the owner activating), provenance from edit history,
 * and migration. `validateDraft` reads envelopes; the status an envelope
 * declares is never trusted.
 */

export {
  activateEnvelope,
  type CreateEnvelopeInput,
  createEnvelope,
  createValidationReceipt,
  type EnvelopeValidationReceipt,
  type LifecycleResult,
  type MigrateResult,
  migrateEnvelope,
  type ProvenanceRecorder,
  recordProvenance,
  supersedeEnvelope,
  verifyActivation,
} from './lifecycle.ts';
export {
  isEnvelopeLike,
  MAX_ENVELOPE_TEXT,
  MAX_PROVENANCE,
  MAX_SOURCES,
  type ParseEnvelopeOptions,
  type ParseEnvelopeResult,
  parseEnvelope,
} from './parse.ts';
export {
  type BlueprintEnvelope,
  ENVELOPE_FORMAT,
  ENVELOPE_STATUSES,
  ENVELOPE_VERSION,
  type EnvelopeActivation,
  type EnvelopeGenerator,
  type EnvelopeIssue,
  type EnvelopeMeetingRef,
  type EnvelopeProfile,
  type EnvelopeSource,
  type EnvelopeStatus,
  type EnvelopeTrigger,
  type ProvenanceEntry,
  SUPPORTED_ENVELOPE_VERSIONS,
  SUPPORTED_SPEC_VERSIONS,
} from './types.ts';
