/** A host-owned, validated SVG path tree; arbitrary SVG markup is never accepted. */
export interface SanitizedEmojiSvg {
  readonly viewBox: '0 0 64 64';
  readonly paths: readonly { readonly d: string; readonly fill: `#${string}` }[];
}

/** A URL is rechecked with Texuli's developer URL policy before rendering. */
export type EmojiArt =
  | { readonly kind: 'image'; readonly src: string }
  | {
      readonly kind: 'svg';
      readonly svg: SanitizedEmojiSvg;
    };

/** Host resolver seam for @texuli/emoji-assets or another reviewed source. */
export type EmojiArtResolver = (id: string) => EmojiArt | undefined;

const PATH_COMMANDS = /^[MmZzLlHhVvCcSsQqTtAa0-9eE+.,\s-]+$/;
const HEX_COLOR = /^#[\da-fA-F]{3}(?:[\da-fA-F]{3})?(?:[\da-fA-F]{2})?$/;

/** Accept only the bounded node subset emitted by the reviewed asset pipeline. */
export function isSanitizedEmojiSvg(value: unknown): value is SanitizedEmojiSvg {
  if (!value || typeof value !== 'object') return false;
  const svg = value as Partial<SanitizedEmojiSvg>;
  return (
    svg.viewBox === '0 0 64 64' &&
    Array.isArray(svg.paths) &&
    svg.paths.length > 0 &&
    svg.paths.length <= 128 &&
    svg.paths.every(
      (path) =>
        typeof path?.d === 'string' &&
        path.d.length <= 4096 &&
        PATH_COMMANDS.test(path.d) &&
        typeof path.fill === 'string' &&
        HEX_COLOR.test(path.fill)
    )
  );
}
