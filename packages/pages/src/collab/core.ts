/**
 * `@texuli/pages/collab-core` (G123): `@texuli/pages/collab` without the default player
 * loader. `CollabEditorCore` is `CollabEditor` with no `loadPlayer` default: live
 * embeds paint only with the host's loader (`() => import('@texuli/player')`),
 * so a host on this entry has no `@texuli/player` reference in its build,
 * static or dynamic. Every other export is the same as `@texuli/pages/collab`.
 */

export type { PagesPlayerLoader, PagesPlayerModule } from '../shared/player-loader.ts';
export { default as CollabEditorCore } from './CollabEditorCore.svelte';
export { default as CollabOverlay } from './CollabOverlay.svelte';
export { default as CollaboratorList } from './CollaboratorList.svelte';
export { default as CommentSidebar } from './CommentSidebar.svelte';
export { feedArticles, feedKeydown } from './feed.ts';
export {
  blockElement,
  HIGHLIGHT_NAMES,
  HighlightLayer,
  rangeFor,
  supportsHighlights,
} from './highlights.ts';
export {
  type CollabLabels,
  DEFAULT_COLLAB_LABELS,
  landmarkPerson,
  resolveCollabLabels,
} from './labels.ts';
export { default as SuggestionList } from './SuggestionList.svelte';
export {
  type CollabRange,
  CollabSession,
  type CollabSessionOptions,
  type CommentDraft,
  createCollabSession,
  presenceColor,
} from './session.svelte.ts';
export { default as VersionHistory } from './VersionHistory.svelte';
