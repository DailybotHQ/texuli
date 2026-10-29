export type ChatMessageStatus = 'sending' | 'sent' | 'delivered' | 'read' | 'failed';

export interface ChatAuthor {
  id: string;
  name: string;
  avatarUrl?: string;
}

export interface ChatMessage {
  id: string;
  author: ChatAuthor;
  body: string;
  at: Date | string | number;
  status?: ChatMessageStatus;
  /** True while an agent is still writing this message (see `applyChatStreamEvent`). */
  streaming?: boolean;
}

export interface MessageGroup {
  key: string;
  author: ChatAuthor;
  messages: ChatMessage[];
  dayStart: Date | null;
}

/** What the `MessageList` `actions` snippet receives beside the message. */
export interface ChatMessageActions {
  /** Opens inline edit for this message (needs `onEdit` on the list). */
  edit: () => void;
  /** True when the list accepts edits (`onEdit` is set). */
  canEdit: boolean;
}
