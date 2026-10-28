// @vitest-environment node

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { safeParseBlock } from '@texuli/blocks/core';
import { describe, expect, it } from 'vitest';
import { buildCatalog } from '../src/build/build.ts';
import { discoverManifestGroups } from '../src/build/node.ts';
import { renderCatalogFromBuild } from '../src/render/renderer/index.ts';
import {
  DECK_ROOT_CATALOG_ID,
  DECK_SLIDE_CATALOG_ID,
  deckV2ToLayoutTree,
  layoutDeckToV2,
  validateDeckDraft,
} from '../src/validate/index.ts';

const here = dirname(fileURLToPath(import.meta.url));
const build = await buildCatalog(await discoverManifestGroups());
const catalog = renderCatalogFromBuild(build.catalog);

const golden = JSON.parse(readFileSync(join(here, 'fixtures/09-deck-v2.json'), 'utf8')) as {
  tree: unknown;
};
const hostile = JSON.parse(
  readFileSync(join(here, 'fixtures/09-deck-v2-hostile.json'), 'utf8')
) as {
  cases: { name: string; tree: unknown; expect: string }[];
};

describe('validateDeckDraft (model v2 encoding)', () => {
  it('accepts a layout-deck + deck-slide golden tree and maps formatVersion 2', () => {
    const result = validateDeckDraft(golden.tree, { catalog, checkBlock: safeParseBlock });
    expect(result.draft.ok).toBe(true);
    expect(result.ok).toBe(true);
    expect(result.deck?.formatVersion).toBe(2);
    expect(result.deck?.meta.title).toBe('Northwind Q1 review');
    expect(result.deck?.slides).toHaveLength(2);
    expect(result.deck?.slides[0]).toMatchObject({ id: 'agenda', layout: 'free' });
    expect(result.deck?.slides[1]).toMatchObject({ id: 'close' });
    expect(result.legacyCards).toBe(false);
  });

  it('round-trips deckV2ToLayoutTree → layoutDeckToV2 for the golden mapping', () => {
    const first = layoutDeckToV2(golden.tree);
    expect(first.deck).not.toBeNull();
    const tree = deckV2ToLayoutTree(first.deck);
    expect(tree?.id).toBe(DECK_ROOT_CATALOG_ID);
    const kids = tree?.children as { id: string }[];
    expect(kids.every((c) => c.id === DECK_SLIDE_CATALOG_ID)).toBe(true);
    const second = layoutDeckToV2(tree);
    expect(second.deck?.meta.title).toBe(first.deck?.meta.title);
    expect(second.deck?.slides).toHaveLength(2);
  });

  it('maps a slide themeRef to the deck v2 slide theme and back', () => {
    const tree = {
      id: DECK_ROOT_CATALOG_ID,
      props: { title: 'Themed' },
      children: [
        { id: DECK_SLIDE_CATALOG_ID, props: { title: 'One', themeRef: 'ocean' }, children: [] },
      ],
    };
    const mapped = layoutDeckToV2(tree);
    const slide = mapped.deck?.slides[0] as Record<string, unknown> | undefined;
    expect(slide?.theme).toBe('ocean');
    expect(slide).not.toHaveProperty('themeRef');
    const back = deckV2ToLayoutTree(mapped.deck);
    const child = (back?.children as { props: Record<string, unknown> }[] | undefined)?.[0];
    expect(child?.props.themeRef).toBe('ocean');
  });

  it('projects legacy layout-card children with a warning', () => {
    const tree = {
      id: 'layout-deck',
      props: { title: 'Legacy' },
      children: [
        {
          id: 'layout-card',
          props: { title: 'One' },
          children: [{ id: 'blocks-text', props: { block: { type: 'text', markdown: 'Hi' } } }],
        },
      ],
    };
    const result = validateDeckDraft(tree, { catalog, checkBlock: safeParseBlock });
    expect(result.ok).toBe(true);
    expect(result.legacyCards).toBe(true);
    expect(result.diagnostics.some((d) => d.code === 'deck-legacy-cards')).toBe(true);
    expect(result.deck?.slides[0]?.id).toBe('slide-1');
  });

  it('refuses non-deck roots and empty decks', () => {
    for (const c of hostile.cases) {
      const result = validateDeckDraft(c.tree, { catalog, checkBlock: safeParseBlock });
      if (c.expect === 'invalid-root') {
        expect(result.ok, c.name).toBe(false);
        expect(result.deck, c.name).toBeNull();
      }
      if (c.expect === 'deck-empty') {
        expect(result.ok, c.name).toBe(false);
        expect(
          result.diagnostics.some((d) => d.code === 'deck-empty' || d.code === 'deck-schema'),
          c.name
        ).toBe(true);
      }
    }
  });

  it('accepts a loadDeck hook that upgrades the mapped plain object', () => {
    const result = validateDeckDraft(golden.tree, {
      catalog,
      checkBlock: safeParseBlock,
      loadDeck: ({ mapped }) => ({
        deck: {
          ...mapped,
          meta: { ...mapped.meta, title: `${mapped.meta.title} (loaded)` },
        },
      }),
    });
    expect(result.ok).toBe(true);
    expect(result.deck?.meta.title).toBe('Northwind Q1 review (loaded)');
  });
});
