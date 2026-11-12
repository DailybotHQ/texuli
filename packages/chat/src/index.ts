// @texuli/chat: the thread, message list, composer, typing indicator and attachment card exported from this package.

export {
  CHAT_ATTACHMENT_LIMITS,
  ChatAttachment,
  type ChatAttachmentCheck,
  type ChatAttachmentLabels,
  DEFAULT_CHAT_ATTACHMENT_LABELS,
  runAttachmentCheck,
} from './attachment/index.ts';
export {
  COMPOSER_MAX_SUGGESTIONS,
  type CommandCandidate,
  Composer,
  type ComposerActionContext,
  type ComposerLabels,
  type ComposerSuggestion,
  type ComposerSuggestionSource,
  commandSuggestions,
  DEFAULT_COMPOSER_LABELS,
  type MentionCandidate,
  mentionSuggestions,
  rankSuggestions,
  TypingIndicator,
  type TypingLabels,
} from './composer/index.ts';
export {
  CHAT_DISPLAY_LOADERS,
  CHAT_DISPLAY_ROLE_LABELS,
  CHAT_DISPLAY_ROLES,
  type ChatDisplayRole,
  ChatMessageDisplay,
  ChatThreadDisplay,
} from './display/index.ts';
export {
  applyChatStreamEvent,
  type ChatAuthor,
  type ChatMessage,
  type ChatMessageActions,
  type ChatMessageStatus,
  type ChatReadingAnchor,
  type ChatStreamEvent,
  ChatThread,
  groupMessages,
  MAX_STREAM_BODY,
  MESSAGE_STATUS_TONES,
  type MessageGroup,
  MessageList,
  type MessageListLabels,
  type MessageStatusTone,
  type MessageTextPart,
  messageTokens,
  parseMessageText,
} from './thread/index.ts';
