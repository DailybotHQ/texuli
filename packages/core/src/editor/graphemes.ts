/**
 * Grapheme and word boundaries for caret movement and deletion, from
 * `Intl.Segmenter` when the platform has it, else code points (a surrogate
 * pair is never split). Offsets are UTF-16 code units.
 */

type Segmenter = {
  segment(text: string): Iterable<{ index: number; segment: string; isWordLike?: boolean }>;
};

const cache = new Map<string, Segmenter | null>();

function segmenter(granularity: 'grapheme' | 'word'): Segmenter | null {
  if (!cache.has(granularity)) {
    const Ctor = (Intl as { Segmenter?: new (locale?: string, options?: object) => Segmenter })
      .Segmenter;
    cache.set(granularity, Ctor ? new Ctor(undefined, { granularity }) : null);
  }
  return cache.get(granularity) ?? null;
}

/** Every grapheme boundary of `text`, ascending, from 0 to `text.length`. */
export function graphemeBoundaries(text: string): number[] {
  const seg = segmenter('grapheme');
  const out: number[] = [];
  if (seg) for (const part of seg.segment(text)) out.push(part.index);
  else
    for (let i = 0; i < text.length; i += (text.codePointAt(i) ?? 0) > 0xffff ? 2 : 1) out.push(i);
  out.push(text.length);
  return out;
}

const clamp = (text: string, offset: number) =>
  Math.max(0, Math.min(text.length, Math.trunc(offset) || 0));

/** The nearest grapheme boundary at or before `offset`. */
export function snapToGrapheme(text: string, offset: number): number {
  const at = clamp(text, offset);
  return graphemeBoundaries(text).findLast((boundary) => boundary <= at) ?? 0;
}

/** The grapheme boundary before `offset` (0 at the start). */
export function previousGrapheme(text: string, offset: number): number {
  const at = clamp(text, offset);
  return graphemeBoundaries(text).findLast((boundary) => boundary < at) ?? 0;
}

/** The grapheme boundary after `offset` (`text.length` at the end). */
export function nextGrapheme(text: string, offset: number): number {
  const at = clamp(text, offset);
  return graphemeBoundaries(text).find((boundary) => boundary > at) ?? text.length;
}

function words(text: string): { start: number; end: number; word: boolean }[] {
  const seg = segmenter('word');
  if (seg) {
    return [...seg.segment(text)].map((part) => ({
      start: part.index,
      end: part.index + part.segment.length,
      word: part.isWordLike === true,
    }));
  }
  return [...text.matchAll(/[\p{L}\p{N}_]+|[^\p{L}\p{N}_]+/gu)].map((match) => ({
    start: match.index ?? 0,
    end: (match.index ?? 0) + match[0].length,
    word: /[\p{L}\p{N}_]/u.test(match[0]),
  }));
}

/** Start of the word before `offset`, skipping spaces and punctuation first. */
export function previousWord(text: string, offset: number): number {
  const at = clamp(text, offset);
  const before = words(text).filter((part) => part.start < at);
  const word = before.findLast((part) => part.word);
  return word ? word.start : 0;
}

/** End of the word after `offset`, skipping spaces and punctuation first. */
export function nextWord(text: string, offset: number): number {
  const at = clamp(text, offset);
  const word = words(text).find((part) => part.end > at && part.word);
  return word ? word.end : text.length;
}
