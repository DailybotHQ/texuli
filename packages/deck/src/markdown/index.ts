/**
 * @texuli/deck/markdown: the deck Markdown dialect (ADR-009). reveal.js is an
 * inspiration, not a compatibility target, and there is no HTML:
 *
 * - `parseDeckMarkdown(text, options)` reads closed-key scalar frontmatter,
 *   `---` slides and `--` vertical stacks, `Note:`, `<!-- .slide: -->` and
 *   `<!-- .element: -->` attributes from a closed set (reveal.js aliases
 *   mapped), fragments, code fences with `[1-2|4-6]` steps, `$$` math, the
 *   20 layouts through `layout="<id>"` and `:::` regions, and
 *   `::: component <id>` fences with a bounded JSON body. Raw HTML, iframes,
 *   `class`, `style` and `on*` are refused with a diagnostic. It returns the
 *   same validated `Deck` as `parseDeck`, every issue with a source line and
 *   column, and the source map.
 * - `deckToMarkdown(deck)` writes canonical Markdown that reads back as the
 *   same deck (JSON fences where Markdown would not round-trip).
 * - `deckToText` and `deckOutline` are the one-way text twins.
 *
 * Inline `$…$` math stays inside text blocks as written; block `$$` math
 * becomes a `{ type: "math", tex }` block (see `@texuli/deck/math`).
 */
export { type Attr, attributeWritable, readAttributes, writeAttribute } from './attributes.ts';
export { mapEffect } from './attrs-closed.ts';
export { FRONTMATTER_KEYS } from './frontmatter.ts';
export { DECK_MARKDOWN_CODES, type DeckMarkdownCode, type DeckMarkdownCodeInfo } from './issues.ts';
export { type JsonReadOptions, type JsonReadResult, readJson } from './json.ts';
export { DECK_MARKDOWN_LIMITS } from './limits.ts';
export {
  type DeckDraft,
  type DeckMarkdownResult,
  deriveSlideId,
  type ParseDeckMarkdownOptions,
  parseDeckMarkdown,
  readDeckDraft,
} from './parse.ts';
export {
  type DeckOutlineSlide,
  type DeckOutlineText,
  type DeckTextOptions,
  deckOutline,
  deckToText,
  formatDeckOutline,
  slideTitle,
} from './twin.ts';
export { type DeckMarkdownWriteResult, deckToMarkdown, writeDeckMarkdown } from './write.ts';
