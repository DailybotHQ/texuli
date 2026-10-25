import { hasCommandModifier, isComposing, type KeyboardEventLike } from '../keyboard/keys.ts';

export interface TypeaheadOptions {
  /** Milliseconds after the last key before the typed text starts over. Defaults to 500. */
  timeout?: number;
  /** The clock (milliseconds). Defaults to `performance.now`. */
  now?: () => number;
}

export interface Typeahead {
  /** The text typed so far in this burst. */
  readonly buffer: string;
  /**
   * Adds the event's character to the buffer and returns the index of the
   * item whose label starts with it, or -1 (the key is not text, nothing
   * matches, or no item is `enabled`).
   */
  match(
    event: KeyboardEventLike,
    labels: readonly string[],
    current: number,
    enabled?: (index: number) => boolean
  ): number;
  /** Clears the buffer. */
  reset(): void;
}

/**
 * Typeahead for lists and menus, as people expect from native selects:
 *
 * - typing a few letters quickly (within `timeout`, 500 ms by default) jumps
 *   to the first item, from the current one on, whose label starts with
 *   them, ignoring case;
 * - pressing the same letter again cycles through the items starting with it;
 * - Space joins words once a search has started, and is otherwise left to
 *   activate the item.
 *
 * Composition, command chords and keys that are not one character never
 * search.
 */
export function createTypeahead(options: TypeaheadOptions = {}): Typeahead {
  const { timeout = 500, now = () => globalThis.performance?.now() ?? Date.now() } = options;
  let buffer = '';
  let last = Number.NEGATIVE_INFINITY;

  return {
    get buffer() {
      return buffer;
    },
    reset() {
      buffer = '';
    },
    match(event, labels, current, enabled = () => true) {
      const char = event.key;
      if (char.length !== 1 || isComposing(event) || hasCommandModifier(event)) return -1;
      const time = now();
      if (time - last > timeout) buffer = '';
      last = time;
      if (char === ' ' && buffer === '') return -1;
      buffer += char.toLowerCase();
      // "aaa" cycles through items starting with "a"; "ab" refines the search.
      const cycling = [...buffer].every((c) => c === buffer[0]);
      const search = cycling ? (buffer[0] ?? '') : buffer;
      // A new letter moves past the current item; a longer search may keep it.
      const start = cycling ? current + 1 : Math.max(current, 0);
      for (let i = 0; i < labels.length; i++) {
        const at = (start + i) % labels.length;
        if (enabled(at) && (labels[at] ?? '').toLowerCase().startsWith(search)) return at;
      }
      return -1;
    },
  };
}
