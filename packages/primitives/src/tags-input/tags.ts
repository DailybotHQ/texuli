/**
 * Pure tag rules: splitting typed or pasted text and deciding which tags are
 * accepted. No DOM, so every rule is unit tested directly.
 */

export type TagRejection = 'duplicate' | 'max' | 'invalid';

/**
 * What splits typed and pasted text into tags: one string, several strings
 * (any of them), or a RegExp.
 */
export type TagDelimiter = string | readonly string[] | RegExp;

export interface TagRules {
  /** Separator for typed and pasted text. One-character delimiters also add a tag when typed. Default `,`. */
  delimiter: TagDelimiter;
  allowDuplicates: boolean;
  /** Most tags allowed; `Infinity` for no limit. */
  max: number;
  /** `false` or a message rejects the tag; `true` accepts it. */
  validate?: (tag: string, tags: readonly string[]) => boolean | string;
}

export interface TagDecision {
  /** The tags after accepting what could be accepted. */
  tags: string[];
  added: string[];
  rejected: { tag: string; reason: TagRejection; message?: string }[];
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** One separator for `String.split`: a list becomes an alternation of its literal strings. */
function separatorOf(delimiter: TagDelimiter): string | RegExp | null {
  if (typeof delimiter === 'string' || delimiter instanceof RegExp) return delimiter;
  const parts = delimiter.filter((part) => typeof part === 'string' && part !== '');
  if (parts.length === 0) return null;
  if (parts.length === 1) return parts[0] as string;
  return new RegExp(parts.map(escapeRegExp).join('|'));
}

/** Splits text on the delimiter(s) and line breaks, trimming each piece and dropping empty ones. */
export function splitTags(text: string, delimiter: TagDelimiter): string[] {
  const separator = separatorOf(delimiter);
  const lines = text.split(/\r\n|\r|\n/);
  const pieces = separator === null ? lines : lines.flatMap((line) => line.split(separator));
  return pieces.map((piece) => piece.trim()).filter((piece) => piece !== '');
}

/**
 * True when typing `key` (a `KeyboardEvent.key`) should add the draft as a
 * tag: it is a one-character delimiter of the list (or the string), or a
 * single character the RegExp matches. Named keys (`Enter`, `Tab`) never match.
 */
export function isDelimiterKey(key: string, delimiter: TagDelimiter): boolean {
  if ([...key].length !== 1) return false;
  if (typeof delimiter === 'string') return delimiter === key;
  if (delimiter instanceof RegExp) {
    // A copy without `g`/`y`, so `lastIndex` never carries over between keys.
    const single = new RegExp(delimiter.source, delimiter.flags.replace(/[gy]/g, ''));
    return single.test(key);
  }
  return delimiter.includes(key);
}

/** Accepts `candidates` one by one against the rules, in order. */
export function addTags(
  current: readonly string[],
  candidates: readonly string[],
  rules: TagRules
): TagDecision {
  const tags = [...current];
  const added: string[] = [];
  const rejected: TagDecision['rejected'] = [];
  for (const tag of candidates) {
    if (!rules.allowDuplicates && tags.includes(tag)) {
      rejected.push({ tag, reason: 'duplicate' });
      continue;
    }
    if (tags.length >= rules.max) {
      rejected.push({ tag, reason: 'max' });
      continue;
    }
    const verdict = rules.validate?.(tag, tags) ?? true;
    if (verdict !== true) {
      rejected.push({
        tag,
        reason: 'invalid',
        ...(typeof verdict === 'string' ? { message: verdict } : {}),
      });
      continue;
    }
    tags.push(tag);
    added.push(tag);
  }
  return { tags, added, rejected };
}
