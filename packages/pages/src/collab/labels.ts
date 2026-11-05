/**
 * Every visible and announced string of the collaboration UI. Hosts pass a
 * partial object to translate; functions build sentences so word order
 * stays the translator's.
 */
import { englishMessages, type MessageLookup } from '@texuli/core/i18n';
import type { DocumentChange } from '@texuli/document/collab';

export interface CollabLabels {
  /** The collaboration region's name. */
  region: string;
  /**
   * A landmark's name in one person's view: every landmark the collaboration
   * UI names (the editor region, the breadcrumb, the sidebar and its panels)
   * goes through it with the session author's name (or the replica id), so two
   * editors on one page never repeat a landmark name (axe `landmark-unique`).
   */
  landmark: (name: string, person: string) => string;
  toolbar: string;
  comment: string;
  /** The keyboard shortcut hint of the comment button. */
  commentShortcut: string;
  suggesting: string;
  history: string;
  collaborators: string;
  /** A collaborator in the list; `where` is an excerpt of the block their caret is in. */
  collaborator: (name: string, where: string | null) => string;
  you: (name: string) => string;
  comments: string;
  noComments: string;
  newComment: (quote: string) => string;
  newBlockComment: string;
  commentBody: string;
  submitComment: string;
  cancel: string;
  reply: string;
  replyLabel: (author: string) => string;
  resolve: string;
  reopen: string;
  resolved: string;
  showInText: string;
  deleteThread: string;
  detached: string;
  threadName: (author: string, quote: string) => string;
  suggestions: string;
  noSuggestions: string;
  accept: string;
  reject: string;
  acceptAll: string;
  rejectAll: string;
  suggestionName: (author: string) => string;
  inserted: (text: string) => string;
  deleted: (text: string) => string;
  versions: string;
  noVersions: string;
  versionName: string;
  saveVersion: string;
  compare: string;
  restore: (name: string) => string;
  versionBy: (author: string) => string;
  noChanges: string;
  change: (change: DocumentChange) => string;
  // Announcements
  commentAdded: string;
  commentRefused: string;
  replied: string;
  threadResolved: string;
  threadReopened: string;
  threadDeleted: string;
  suggestionAccepted: string;
  suggestionRejected: string;
  suggestingOn: string;
  suggestingOff: string;
  versionSaved: (name: string) => string;
  versionRestored: (name: string) => string;
  selectText: string;
}

const quote = (text: string) => (text.length > 60 ? `${text.slice(0, 57)}…` : text);

/**
 * The collaboration labels for one message lookup (ADR-026): every string
 * resolves as `messages('pages.collab.<id>', english, values)`, so the label
 * dictionary in context translates it (`{name}` placeholders). With
 * `englishMessages` it is `DEFAULT_COLLAB_LABELS`.
 */
export function collabLabelsFor(messages: MessageLookup): CollabLabels {
  const m = (id: string, english: string, values?: Record<string, string | number>) =>
    messages(`pages.collab.${id}`, english, values);
  const change = (id: string, english: string, type: string, text: string) =>
    text
      ? m(`${id}-text`, `${english}: “{text}”`, { type, text: quote(text) })
      : m(id, english, { type });
  return {
    region: m('region', 'Collaboration'),
    landmark: (name, person) =>
      person ? m('landmark', '{name} ({person})', { name, person }) : name,
    toolbar: m('toolbar', 'Review'),
    comment: m('comment', 'Comment'),
    commentShortcut: m('comment-shortcut', 'Control+Alt+M'),
    suggesting: m('suggesting', 'Suggesting'),
    history: m('history', 'Version history'),
    collaborators: m('collaborators', 'People here'),
    collaborator: (name, where) =>
      where ? m('collaborator-in', '{name}, in “{where}”', { name, where: quote(where) }) : name,
    you: (name) => m('you', '{name} (you)', { name }),
    comments: m('comments', 'Comments'),
    noComments: m('no-comments', 'No comments yet.'),
    newComment: (text) => m('new-comment', 'Comment on “{quote}”', { quote: quote(text) }),
    newBlockComment: m('new-block-comment', 'Comment on this block'),
    commentBody: m('comment-body', 'Comment'),
    submitComment: m('submit-comment', 'Comment'),
    cancel: m('cancel', 'Cancel'),
    reply: m('reply', 'Reply'),
    replyLabel: (author) => m('reply-label', 'Reply to {author}', { author }),
    resolve: m('resolve', 'Resolve'),
    reopen: m('reopen', 'Reopen'),
    resolved: m('resolved', 'Resolved'),
    showInText: m('show-in-text', 'Show in text'),
    deleteThread: m('delete-thread', 'Delete thread'),
    detached: m('detached', 'The text this comment was on was deleted.'),
    threadName: (author, text) =>
      text
        ? m('thread-on-text', '{author} on “{quote}”', { author, quote: quote(text) })
        : m('thread-on-block', '{author} on a block', { author }),
    suggestions: m('suggestions', 'Suggestions'),
    noSuggestions: m('no-suggestions', 'No suggestions.'),
    accept: m('accept', 'Accept'),
    reject: m('reject', 'Reject'),
    acceptAll: m('accept-all', 'Accept all'),
    rejectAll: m('reject-all', 'Reject all'),
    suggestionName: (author) =>
      m('suggestion-by', 'Suggestion by {author}', { author: author || m('someone', 'someone') }),
    inserted: (text) => m('inserted', 'Insert “{text}”', { text: quote(text) }),
    deleted: (text) => m('deleted', 'Delete “{text}”', { text: quote(text) }),
    versions: m('versions', 'Version history'),
    noVersions: m('no-versions', 'No saved versions.'),
    versionName: m('version-name', 'Version name'),
    saveVersion: m('save-version', 'Save version'),
    compare: m('compare', 'Changes since'),
    restore: (name) => m('restore', 'Restore “{name}”', { name }),
    versionBy: (author) => m('version-by', 'by {author}', { author }),
    noChanges: m('no-changes', 'No changes since this version.'),
    change: (entry) => {
      switch (entry.kind) {
        case 'meta':
          return m('change-meta', 'Changed the {fields}', { fields: entry.fields.join(', ') });
        case 'page':
          return m('change-page', 'Changed the page settings');
        case 'added':
          return change('change-added', 'Added a {type}', entry.type, entry.text);
        case 'removed':
          return change('change-removed', 'Removed a {type}', entry.type, entry.text);
        case 'moved':
          return change('change-moved', 'Moved a {type}', entry.type, entry.text);
        case 'text':
          return m('change-text', 'Edited “{before}” to “{after}”', {
            before: quote(entry.before),
            after: quote(entry.after),
          });
        case 'formatting':
          return m('change-formatting', 'Formatted “{text}”', { text: quote(entry.text) });
        case 'attributes':
          return m('change-attributes', 'Changed the {keys} of a {type}', {
            keys: entry.keys.join(', '),
            type: entry.type,
          });
      }
    },
    commentAdded: m('comment-added', 'Comment added.'),
    commentRefused: m('comment-refused', 'The comment could not be added.'),
    replied: m('replied', 'Reply added.'),
    threadResolved: m('thread-resolved', 'Thread resolved.'),
    threadReopened: m('thread-reopened', 'Thread reopened.'),
    threadDeleted: m('thread-deleted', 'Thread deleted.'),
    suggestionAccepted: m('suggestion-accepted', 'Suggestion accepted.'),
    suggestionRejected: m('suggestion-rejected', 'Suggestion rejected.'),
    suggestingOn: m('suggesting-on', 'Suggesting: your edits are suggestions.'),
    suggestingOff: m('suggesting-off', 'Editing: your edits apply directly.'),
    versionSaved: (name) => m('version-saved', 'Saved the version “{name}”.', { name }),
    versionRestored: (name) => m('version-restored', 'Restored the version “{name}”.', { name }),
    selectText: m('select-text', 'Select text or place the caret in a block to comment.'),
  };
}

export const DEFAULT_COLLAB_LABELS: CollabLabels = collabLabelsFor(englishMessages);

/** The person a session's landmarks are named for: the author's name, or the replica id. */
export function landmarkPerson(session: { author: { name: string }; replica: string }): string {
  return session.author.name.trim() || session.replica;
}

/** Merge partial overrides (empty strings never replace a default). */
export function resolveCollabLabels(
  overrides: Partial<CollabLabels> = {},
  defaults: CollabLabels = DEFAULT_COLLAB_LABELS
): CollabLabels {
  const out = { ...defaults } as Record<string, unknown>;
  for (const [key, value] of Object.entries(overrides)) {
    if (value === undefined || value === '') continue;
    out[key] = value;
  }
  return out as unknown as CollabLabels;
}
