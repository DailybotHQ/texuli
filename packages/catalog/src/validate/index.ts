/**
 * `@texuli/catalog/validate` — the single validation entry for untrusted
 * blueprint JSON, shared by the playground, the golden set, the edit history
 * and the planned player and agent service. Runtime-neutral: no DOM, no
 * Node APIs.
 */

export {
  DRAFT_CHECKS,
  DRAFT_FRAME_IDS,
  DRAFT_TEXT_ALLOWANCE,
  type DraftBlockCheck,
  type DraftCheck,
  type DraftCheckStatus,
  type DraftDiagnostic,
  type DraftStatus,
  type DraftValidation,
  type ValidateDraftOptions,
  validateDraft,
} from './draft.ts';
export { draftCommitGate } from './gate.ts';
export { type SinkFinding, type SinkUrlTier, scanSinks } from './sinks.ts';
