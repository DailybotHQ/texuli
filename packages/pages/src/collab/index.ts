/**
 * @texuli/pages/collab: the page editor on a collaborative session of
 * `@texuli/document/collab` (ADR-010, ADR-011): comments anchored to item
 * ids, suggestions with accept and reject, version history with restore,
 * presence (remote carets and an accessible list of collaborators), all
 * through the editor's op log. Import it lazily: only a collaborative page
 * pays for it.
 */
export { default as CollabEditor } from './CollabEditor.svelte';
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
