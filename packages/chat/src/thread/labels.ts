import type { ChatMessageStatus } from './types.ts';

export type MessageListLabels = Record<ChatMessageStatus | 'you' | 'streaming', string>;

export const DEFAULT_MESSAGE_LIST_LABELS: MessageListLabels = {
  you: 'You',
  sending: 'Sending…',
  sent: 'Sent',
  delivered: 'Delivered',
  read: 'Read',
  failed: 'Failed to send',
  streaming: 'Writing a reply…',
};
