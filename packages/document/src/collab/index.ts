/**
 * @texuli/document/collab: documents on the CRDT of `@texuli/document/sync`
 * (ADR-010 bound to the ADR-011 format). A `DocumentSync` session keeps a
 * replica of a document, turns an editor's accepted changes into replica
 * operations (the id-keyed tree diff) and merged states back into
 * document operations for the editor's op log; comments anchored to item
 * ids, suggestions, named versions with restore, and presence. Framework-
 * free and DOM-free; loads lazily (only a collaborative session imports it).
 */
export {
  ANNOTATION_LIMITS,
  type CollabMessage,
  type CollabSuggestion,
  type CollabThread,
  type CollabVersion,
  type CommentMention,
  type CommentSegment,
  type CommentTarget,
  parseMentions,
  type SuggestionChange,
} from './annotations.ts';
export { type CommitContext, commitDocument, type SuggestContext } from './commit.ts';
export { type DocumentChange, describeChanges, diffDocuments } from './diff.ts';
export { type FieldView, type Projection, Projector, type ProjectorOptions } from './project.ts';
export {
  type Collaborator,
  createDocumentSync,
  type DocumentPoint,
  DocumentSync,
  type DocumentSyncChange,
  type DocumentSyncOptions,
  type DocumentSyncOrigin,
  seedOperations,
} from './session.ts';
export {
  COLLAB_MARK_KEYS,
  COLLAB_NODE_TYPES,
  COMMENTS_NODE,
  collabMarkExpand,
  SUGGEST_DELETE,
  SUGGEST_INSERT,
  SUGGESTIONS_NODE,
  VERSIONS_NODE,
} from './vocabulary.ts';
