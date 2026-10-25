export { default as ChatMessageDisplay } from './ChatMessageDisplay.svelte';
export { default as ChatThreadDisplay } from './ChatThreadDisplay.svelte';
export { CHAT_DISPLAY_ROLE_LABELS, CHAT_DISPLAY_ROLES, type ChatDisplayRole } from './roles.ts';

/**
 * Painters for the G10 chat display ids, in the shape of a player loader map.
 * A host that mounts `@texuli/player` merges them into its `loaders`:
 * `{ ...PLAYER_LOADERS, ...CHAT_DISPLAY_LOADERS }`.
 */
export const CHAT_DISPLAY_LOADERS: Readonly<Record<string, () => Promise<unknown>>> = Object.freeze(
  {
    'chat-thread': async () => (await import('./ChatThreadDisplay.svelte')).default,
    'chat-message': async () => (await import('./ChatMessageDisplay.svelte')).default,
  }
);
