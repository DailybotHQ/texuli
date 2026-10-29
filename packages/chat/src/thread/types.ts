export type ChatMessageStatus = 'sending' | 'sent' | 'delivered' | 'read' | 'failed';

export interface ChatAuthor {
  id: string;
  name: string;
  avatarUrl?: string;
  /**
   * Responsive avatar candidates (`a.webp 1x, b.webp 2x` or width
   * descriptors), used with `avatarUrl`. Each candidate passes the untrusted
   * image URL policy; refused ones are dropped (texuli `Avatar` `srcset`).
   */
  avatarSrcset?: string;
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

/**
 * A reading position in a `MessageList` (`bind:anchor`, `onAnchorChange`):
 * the first message in view and where it sits. Save it per conversation and
 * hand it back to reopen the list at the same place.
 */
export interface ChatReadingAnchor {
  /** The first message in view (the one crossing the viewport's top edge, or the first below it). */
  messageId: string;
  /** Px from the viewport's top edge to the message's top edge (negative when it starts above the view). */
  offset: number;
  /** The reader was at the latest message: restoring scrolls to the bottom and keeps following. */
  atLatest: boolean;
}
