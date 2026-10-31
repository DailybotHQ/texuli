/**
 * @texuli/pages/collab: the page editor on a collaborative session of
 * `@texuli/document/collab` (ADR-010, ADR-011): comments anchored to item
 * ids, suggestions with accept and reject, version history with restore,
 * presence (remote carets and an accessible list of collaborators), all
 * through the editor's op log. Import it lazily: only a collaborative page
 * pays for it.
 */

export { default as CollabEditor } from './CollabEditor.svelte';
export * from './core.ts';
