// @vitest-environment node
import { buildCatalog } from '@texuli/catalog/build';
import { discoverManifestGroups } from '@texuli/catalog/build/node';
import { renderCatalogFromBuild } from '@texuli/catalog/render/renderer';
import { describe, expect, it } from 'vitest';
import { toDeckRenderTree, validateDeckDraft } from '../src/grammar/index.ts';
import { parseDeck } from '../src/model/index.ts';

const build = await buildCatalog(await discoverManifestGroups());
const catalog = renderCatalogFromBuild(build.catalog);

describe('agent decks with slot masters', () => {
  it('validates divider-separated slots at the untrusted tier and reports where blocks land', () => {
    const parsed = parseDeck({
      meta: { title: 'Board update' },
      masters: ['two-column', 'quote', 'title'],
      slides: [
        {
          id: 'compare',
          title: 'Before and after',
          master: 'two-column',
          blocks: [
            { type: 'text', markdown: 'Before' },
            { type: 'divider' },
            { type: 'text', markdown: 'After' },
            { type: 'divider' },
            { type: 'text', markdown: 'Source: example.com' },
          ],
        },
        {
          id: 'voice',
          title: 'Customer voice',
          master: 'quote',
          blocks: [
            { type: 'quote', quote: 'It just works.' },
            { type: 'divider' },
            { type: 'text', markdown: 'Ops lead' },
          ],
        },
        { id: 'cover', title: 'Board update', master: 'title', blocks: [] },
      ],
    });
    if (!parsed.success) throw new Error(parsed.issues[0]?.message);
    const result = validateDeckDraft(toDeckRenderTree(parsed.deck), { catalog });
    expect(result.ok, JSON.stringify(result.diagnostics)).toBe(true);
    expect(result.slides.map((slide) => [slide.slideId, slide.slots])).toEqual([
      ['compare', ['contentStart', 'contentEnd', 'footer']],
      ['voice', ['quote', 'attribution']],
      ['cover', ['body']],
    ]);
  });
});
