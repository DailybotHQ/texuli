/**
 * `@texuli/catalog/render/frame` — host-owned artifact frame for untrusted output.
 *
 * Wraps sink-free render trees with a required visible label/badge. Interactive
 * actions leave as {@link ArtifactIntent} values the host must confirm — the
 * frame never navigates, mutates, or opens network itself.
 */

export {
  artifactChrome,
  confirmIntent,
  createArtifactFrame,
  MAX_INTENT_STRING_LENGTH,
  MAX_INTENT_SUMMARY_LENGTH,
  pendingIntents,
  policyCheckUrl,
  proposeIntent,
  rejectIntent,
  resetArtifactFrameIds,
  sanitizeIntentPayload,
  scrubDisplayText,
} from './frame.ts';
export type {
  ArtifactFrame,
  ArtifactFrameDiagnostic,
  ArtifactFrameIssueCode,
  ArtifactIntent,
  ArtifactIntentKind,
  ArtifactIntentStatus,
  CreateArtifactFrameOptions,
  ProposeIntentInput,
  ProposeIntentResult,
  SettleIntentResult,
} from './types.ts';
