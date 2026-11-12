import type { Component } from 'svelte';

/** `EmojiText` from `texuli/emoji`, loaded once, the first time a message holds an emoji. */
export type EmojiTextComponent = Component<{ text: string }>;

let loading: Promise<EmojiTextComponent | null> | null = null;

/** Emoji pictographs and regional indicators (flags): text that `EmojiText` would read. */
const EMOJI = /\p{Extended_Pictographic}|\p{Regional_Indicator}/u;

export const hasEmoji = (text: string): boolean => EMOJI.test(text);

/**
 * Load `EmojiText` lazily: its Unicode index (about 48 KB gzip) stays out of the chat bundle
 * until a message needs it. Resolves `null` when the module cannot load (text stays plain).
 */
export function loadEmojiText(): Promise<EmojiTextComponent | null> {
  loading ??= import('texuli/emoji').then(
    (module) => module.EmojiText as unknown as EmojiTextComponent,
    () => null
  );
  return loading;
}
