/**
 * Pure tag rules: splitting typed or pasted text and deciding which tags are
 * accepted. No DOM, so every rule is unit tested directly.
 */

export type TagRejection = 'duplicate' | 'max' | 'invalid';

export interface TagRules {
  /** Separator for typed and pasted text. A string also adds a tag when typed. Default `,`. */
  delimiter: string | RegExp;
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

/** Splits text on the delimiter and line breaks, trimming each piece and dropping empty ones. */
export function splitTags(text: string, delimiter: string | RegExp): string[] {
  const pieces = text.split(/\r\n|\r|\n/).flatMap((line) => line.split(delimiter));
  return pieces.map((piece) => piece.trim()).filter((piece) => piece !== '');
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
