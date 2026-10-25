/** Display roles for `chat-message` (G10); kept equal to the player's chat manifest. */
export const CHAT_DISPLAY_ROLES = ['user', 'agent', 'system'] as const;
export type ChatDisplayRole = (typeof CHAT_DISPLAY_ROLES)[number];

/** Visible role text. A `user` message shows no role badge. */
export const CHAT_DISPLAY_ROLE_LABELS: Readonly<Record<ChatDisplayRole, string>> = Object.freeze({
  user: '',
  agent: 'Agent',
  system: 'System',
});
