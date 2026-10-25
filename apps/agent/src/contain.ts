/**
 * Containment for model text (agent-service design §8). Prompt injection is
 * expected, so model text is never trusted: it is shown as plain text with
 * invisible and direction-changing characters removed, and text that repeats
 * the service's own instructions is withheld instead of relayed.
 */

/** What the chat shows instead of model text that repeats the service's instructions. */
export const WITHHELD_NOTE = 'That reply repeated the service instructions, so it was withheld.';

/** Characters that are removed from model text before anyone sees it. */
export function isHiddenOrBidi(code: number): boolean {
  return (
    (code < 0x20 && code !== 0x0a) ||
    (code >= 0x7f && code <= 0x9f) ||
    code === 0x061c ||
    (code >= 0x200b && code <= 0x200f) ||
    (code >= 0x202a && code <= 0x202e) ||
    (code >= 0x2060 && code <= 0x2069) ||
    code === 0xfeff
  );
}

/** Model text as plain text: hidden and bidi characters removed, trimmed, capped. */
export function plainModelText(text: string, max: number, trim = true): string {
  let out = '';
  for (const char of text) {
    if (!isHiddenOrBidi(char.codePointAt(0) ?? 0)) out += char;
  }
  return [...(trim ? out.trim() : out)].slice(0, max).join('');
}

/** Length of the instruction excerpts a reply may not repeat. */
export const LEAK_WINDOW = 48;

function normalize(text: string): string {
  return text.toLowerCase().replace(/\s+/g, ' ').trim();
}

export interface LeakGuard {
  /** True when `text` repeats at least LEAK_WINDOW characters of a guarded text. */
  leaks(text: string): boolean;
}

/**
 * Detects replies that repeat a guarded text (the system prompt, the tool
 * description), compared case- and whitespace-insensitively. Every
 * LEAK_WINDOW-character window of the guarded texts is indexed once.
 */
export function createLeakGuard(guarded: readonly string[]): LeakGuard {
  const windows = new Set<string>();
  for (const source of guarded) {
    const text = normalize(source);
    for (let i = 0; i + LEAK_WINDOW <= text.length; i++)
      windows.add(text.slice(i, i + LEAK_WINDOW));
  }
  return {
    leaks(text) {
      const candidate = normalize(text);
      for (let i = 0; i + LEAK_WINDOW <= candidate.length; i++) {
        if (windows.has(candidate.slice(i, i + LEAK_WINDOW))) return true;
      }
      return false;
    },
  };
}
