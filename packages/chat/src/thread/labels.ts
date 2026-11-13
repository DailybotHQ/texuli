import type { ChatMessageStatus } from './types.ts';

export type MessageListLabels = Record<
  | ChatMessageStatus
  | 'you'
  | 'streaming'
  | 'stopped'
  | 'jumpToLatest'
  | 'newBelow'
  | 'editInput'
  | 'saveEdit'
  | 'cancelEdit',
  string
>;

export const DEFAULT_MESSAGE_LIST_LABELS: MessageListLabels = {
  you: 'You',
  sending: 'Sending…',
  sent: 'Sent',
  delivered: 'Delivered',
  read: 'Read',
  failed: 'Failed to send',
  streaming: 'Writing a reply…',
  stopped: 'Stopped before the end',
  jumpToLatest: 'Jump to latest',
  newBelow: 'New messages below',
  editInput: 'Edit message',
  saveEdit: 'Save',
  cancelEdit: 'Cancel',
};
