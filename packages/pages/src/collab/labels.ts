/**
 * Every visible and announced string of the collaboration UI. Hosts pass a
 * partial object to translate; functions build sentences so word order
 * stays the translator's.
 */
import type { DocumentChange } from '@texuli/document/collab';

export interface CollabLabels {
  /** The collaboration region's name. */
  region: string;
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

export const DEFAULT_COLLAB_LABELS: CollabLabels = {
  region: 'Collaboration',
  toolbar: 'Review',
  comment: 'Comment',
  commentShortcut: 'Control+Alt+M',
  suggesting: 'Suggesting',
  history: 'Version history',
  collaborators: 'People here',
  collaborator: (name, where) => (where ? `${name}, in “${quote(where)}”` : name),
  you: (name) => `${name} (you)`,
  comments: 'Comments',
  noComments: 'No comments yet.',
  newComment: (text) => `Comment on “${quote(text)}”`,
  newBlockComment: 'Comment on this block',
  commentBody: 'Comment',
  submitComment: 'Comment',
  cancel: 'Cancel',
  reply: 'Reply',
  replyLabel: (author) => `Reply to ${author}`,
  resolve: 'Resolve',
  reopen: 'Reopen',
  resolved: 'Resolved',
  showInText: 'Show in text',
  deleteThread: 'Delete thread',
  detached: 'The text this comment was on was deleted.',
  threadName: (author, text) => (text ? `${author} on “${quote(text)}”` : `${author} on a block`),
  suggestions: 'Suggestions',
  noSuggestions: 'No suggestions.',
  accept: 'Accept',
  reject: 'Reject',
  acceptAll: 'Accept all',
  rejectAll: 'Reject all',
  suggestionName: (author) => `Suggestion by ${author || 'someone'}`,
  inserted: (text) => `Insert “${quote(text)}”`,
  deleted: (text) => `Delete “${quote(text)}”`,
  versions: 'Version history',
  noVersions: 'No saved versions.',
  versionName: 'Version name',
  saveVersion: 'Save version',
  compare: 'Changes since',
  restore: (name) => `Restore “${name}”`,
  versionBy: (author) => `by ${author}`,
  noChanges: 'No changes since this version.',
  change: (change) => {
    switch (change.kind) {
      case 'meta':
        return `Changed the ${change.fields.join(', ')}`;
      case 'page':
        return 'Changed the page settings';
      case 'added':
        return `Added a ${change.type}${change.text ? `: “${quote(change.text)}”` : ''}`;
      case 'removed':
        return `Removed a ${change.type}${change.text ? `: “${quote(change.text)}”` : ''}`;
      case 'moved':
        return `Moved a ${change.type}${change.text ? `: “${quote(change.text)}”` : ''}`;
      case 'text':
        return `Edited “${quote(change.before)}” to “${quote(change.after)}”`;
      case 'formatting':
        return `Formatted “${quote(change.text)}”`;
      case 'attributes':
        return `Changed the ${change.keys.join(', ')} of a ${change.type}`;
    }
  },
  commentAdded: 'Comment added.',
  commentRefused: 'The comment could not be added.',
  replied: 'Reply added.',
  threadResolved: 'Thread resolved.',
  threadReopened: 'Thread reopened.',
  threadDeleted: 'Thread deleted.',
  suggestionAccepted: 'Suggestion accepted.',
  suggestionRejected: 'Suggestion rejected.',
  suggestingOn: 'Suggesting: your edits are suggestions.',
  suggestingOff: 'Editing: your edits apply directly.',
  versionSaved: (name) => `Saved the version “${name}”.`,
  versionRestored: (name) => `Restored the version “${name}”.`,
  selectText: 'Select text or place the caret in a block to comment.',
};

/** Merge partial overrides (empty strings never replace a default). */
export function resolveCollabLabels(overrides: Partial<CollabLabels> = {}): CollabLabels {
  const out = { ...DEFAULT_COLLAB_LABELS } as Record<string, unknown>;
  for (const [key, value] of Object.entries(overrides)) {
    if (value === undefined || value === '') continue;
    out[key] = value;
  }
  return out as unknown as CollabLabels;
}
