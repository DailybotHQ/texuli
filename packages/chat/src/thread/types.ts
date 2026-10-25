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
