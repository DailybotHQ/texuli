/**
 * The editor's examples: the built-in starter templates of `@texuli/deck`
 * (fictional, deterministic, draft guidance), written as JSON and as deck
 * Markdown by the engine itself, plus two broken examples that show the
 * diagnostics. Loaded with the engine, after the island mounts.
 */
import { deckToMarkdown } from '@texuli/deck/markdown';
import { createDeckTemplate, DECK_TEMPLATES, type DeckTemplateId } from '@texuli/deck/templates';
import type { EditorTab } from './model.ts';

export interface EditorSeed {
  id: string;
  label: string;
  summary: string;
  /** False for the broken examples. */
  valid: boolean;
}

export const BROKEN_JSON_ID = 'broken-json';
export const BROKEN_MARKDOWN_ID = 'broken-markdown';

/** The seed list (templates first, then the broken examples). */
export const EDITOR_SEEDS: readonly EditorSeed[] = Object.freeze([
  ...DECK_TEMPLATES.map((template) => ({
    id: template.id,
    label: `${template.label} template`,
    summary: template.description,
    valid: true,
  })),
  {
    id: BROKEN_JSON_ID,
    label: 'Broken: JSON syntax and an unknown layout',
    summary: 'Shows syntax errors with line and column, and model errors with JSON paths.',
    valid: false,
  },
  {
    id: BROKEN_MARKDOWN_ID,
    label: 'Broken: Markdown with HTML',
    summary: 'Raw HTML and an iframe background are refused with line and column.',
    valid: false,
  },
]);

export const DEFAULT_SEED_ID = 'pitch';

export function seedById(id: string): EditorSeed | undefined {
  return EDITOR_SEEDS.find((seed) => seed.id === id);
}

const BROKEN_JSON = `{
  "formatVersion": 2,
  "meta": { "title": "Broken example" },
  "slides": [
    { "id": "cover", "layout": "mosaic", "props": {} },
    { "id": "cover", "layout": "free", "blocks": [] }
  ]
`;

const BROKEN_MARKDOWN = `---
title: Broken example
---

# Hello

<div class="grid grid-cols-2">Raw HTML is refused</div>

---

<!-- .slide: data-background-iframe="https://example.com" -->
## An iframe background is refused too
`;

/** The editor text of a seed for one tab. */
export function seedText(seed: EditorSeed, tab: EditorTab): string {
  if (seed.id === BROKEN_JSON_ID) return BROKEN_JSON;
  if (seed.id === BROKEN_MARKDOWN_ID) return BROKEN_MARKDOWN;
  const deck = createDeckTemplate(
    seed.id as DeckTemplateId,
    `${seed.label.replace(/ template$/, '')} deck (example)`
  );
  return tab === 'json' ? `${JSON.stringify(deck, null, 2)}\n` : deckToMarkdown(deck);
}
