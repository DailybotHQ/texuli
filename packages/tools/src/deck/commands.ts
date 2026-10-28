import { DECK_FORMAT_VERSION, DECK_LAYOUTS, deckJsonSchema, parseDeck } from '@texuli/deck';
import { DECK_OUTLINE_IDS, lintDeck } from '@texuli/deck/authoring';
import { deckOutline, deckToMarkdown, parseDeckMarkdown } from '@texuli/deck/markdown';
import { DECK_LAYOUT_IDS } from '@texuli/deck/model';
import { DECK_TEMPLATES } from '@texuli/deck/templates';

export const DECK_COMMANDS = [
  'capabilities',
  'schema',
  'layouts',
  'lint',
  'inspect',
  'from-markdown',
  'to-markdown',
] as const;
export type DeckCommandName = (typeof DECK_COMMANDS)[number];
export type DeckCommandInput = { deck?: unknown; markdown?: string };

/** Pure command adapter shared by the CLI and MCP tool. */
export function runDeckCommand(command: DeckCommandName, input: DeckCommandInput = {}): unknown {
  if (command === 'capabilities')
    return {
      formatVersion: DECK_FORMAT_VERSION,
      commands: DECK_COMMANDS,
      layouts: DECK_LAYOUT_IDS,
      outlines: DECK_OUTLINE_IDS,
      templates: DECK_TEMPLATES,
      sources: ['json', 'markdown'],
    };
  if (command === 'schema')
    return deckJsonSchema({ $id: 'https://texuli.com/schemas/deck-v2.json' });
  if (command === 'layouts') return { layouts: DECK_LAYOUT_IDS.map((id) => DECK_LAYOUTS[id]) };
  if (command === 'lint') return lintDeck(input.deck);
  if (command === 'from-markdown') {
    if (typeof input.markdown !== 'string') return { ok: false, error: 'Provide markdown text.' };
    const parsed = parseDeckMarkdown(input.markdown);
    return { ok: parsed.ok, deck: parsed.deck, issues: parsed.issues };
  }
  if (command === 'to-markdown') {
    const parsed = parseDeck(input.deck);
    if (!parsed.ok || !parsed.deck) return { ok: false, issues: parsed.issues };
    return { ok: true, markdown: deckToMarkdown(parsed.deck) };
  }
  if (command === 'inspect') {
    const parsed = parseDeck(input.deck);
    if (!parsed.ok || !parsed.deck) return { ok: false, issues: parsed.issues };
    const deck = parsed.deck;
    return {
      ok: true,
      meta: deck.meta,
      slideCount: deck.slides.length,
      outline: deckOutline(deck),
      slides: deck.slides.map((slide, index) => ({
        index,
        id: slide.id,
        title:
          slide.title ??
          ('props' in slide && slide.props && 'title' in slide.props
            ? slide.props.title
            : undefined),
        layout: slide.layout,
        hidden: slide.hidden ?? false,
        notes: Boolean(slide.notes),
      })),
      slideRefs: Object.fromEntries(
        deck.slides.map((slide) => [
          slide.id,
          { index: deck.slides.indexOf(slide), title: slide.title ?? slide.id },
        ])
      ),
    };
  }
  return { ok: false, error: `Unknown deck command: ${String(command)}` };
}
