// @vitest-environment node
import { buildCatalog } from '@texuli/catalog/build';
import { discoverManifestGroups } from '@texuli/catalog/build/node';
import { renderCatalogFromBuild } from '@texuli/catalog/render/renderer';
import { describe, expect, it } from 'vitest';
import { buildDeckPptx } from '../src/export/index.ts';
import { toDeckRenderTree, validateDeckDraft } from '../src/grammar/index.ts';
import { composeSlide, resolveSlideTheme } from '../src/model/index.ts';
import { gateDeckMedia } from '../src/stage/media.ts';
import { loadDeckLibraryTheme } from '../src/stage/theme.ts';
import {
  createDeckFromTemplate,
  DECK_TEMPLATE_IDS,
  DECK_TEMPLATES,
  type DeckTemplateId,
} from '../src/templates/index.ts';

const build = await buildCatalog(await discoverManifestGroups());
const catalog = renderCatalogFromBuild(build.catalog);

const STRUCTURE: Record<DeckTemplateId, [string, string][]> = {
  report: [
    ['cover', 'title'],
    ['summary', 'content'],
    ['numbers', 'content'],
    ['trend', 'media-left'],
    ['risks', 'content'],
    ['next', 'closing'],
  ],
  pitch: [
    ['cover', 'title'],
    ['problem', 'section'],
    ['solution', 'media-right'],
    ['proof', 'content'],
    ['voice', 'quote'],
    ['ask', 'closing'],
  ],
  review: [
    ['cover', 'title'],
    ['goals', 'content'],
    ['shipped', 'two-column'],
    ['demo', 'media-left'],
    ['next', 'closing'],
  ],
};

describe('deck templates', () => {
  it('publishes report, pitch and review', () => {
    expect(DECK_TEMPLATE_IDS).toEqual(['report', 'pitch', 'review']);
    expect(Object.keys(DECK_TEMPLATES)).toEqual(['report', 'pitch', 'review']);
    expect(Object.isFrozen(DECK_TEMPLATES)).toBe(true);
  });

  it.each(DECK_TEMPLATE_IDS)('%s: pins its slides, masters and theme default', (id) => {
    const template = DECK_TEMPLATES[id];
    const deck = createDeckFromTemplate(id);
    expect(deck.slides.map((slide) => [slide.id, slide.master])).toEqual(STRUCTURE[id]);
    expect(deck.masters).toEqual([...new Set(STRUCTURE[id].map(([, master]) => master))]);
    expect(deck.meta).toMatchObject({
      aspect: '16:9',
      themeRef: { kind: 'catalog', id: template.themeId },
    });
    expect(deck.settings.defaultTransition).toBe('fade');
    expect(deck.slides.every((slide) => slide.title && slide.themeRef === undefined)).toBe(true);
    expect(deck.slides.some((slide) => slide.notes)).toBe(true);
  });

  it.each(DECK_TEMPLATE_IDS)('%s: validates clean as an untrusted agent tree', (id) => {
    const result = validateDeckDraft(toDeckRenderTree(createDeckFromTemplate(id)), { catalog });
    expect(result.diagnostics).toEqual([]);
    expect(result.ok).toBe(true);
    expect(result.draft.checks).toMatchObject({
      render: 'pass',
      blocks: 'pass',
      grammar: 'pass',
      sinks: 'pass',
    });
  });

  it.each(DECK_TEMPLATE_IDS)(
    '%s: places its image in the media region and passes the paint policy',
    (id) => {
      const deck = createDeckFromTemplate(id);
      const mediaSlide = deck.slides.find((slide) => slide.master?.startsWith('media-'));
      if (!mediaSlide) throw new Error('template has no media slide');
      const media = composeSlide(mediaSlide).regions.find((region) => region.slot === 'media');
      const block = media?.blocks[0];
      expect(block?.type === 'image' || block?.type === 'figure').toBe(true);
      expect(block && 'src' in block ? block.src : '').toBe(
        Object.values(DECK_TEMPLATES[id].imageSlots)[0]
      );
      if (block) expect(gateDeckMedia(block).block).not.toBeNull();
    }
  );

  it.each(DECK_TEMPLATE_IDS)('%s: default theme id exists in the token library', async (id) => {
    const theme = await loadDeckLibraryTheme(DECK_TEMPLATES[id].themeId);
    expect(theme.id).toBe(DECK_TEMPLATES[id].themeId);
  });

  it('rebrands every slide with one theme reference and takes title, aspect and locale', () => {
    const deck = createDeckFromTemplate('pitch', {
      title: 'Northwind',
      themeRef: { kind: 'catalog', id: 'emerald', mode: 'dark' },
      aspect: '4:3',
      locale: 'en-GB',
    });
    expect(deck.meta).toMatchObject({ title: 'Northwind', aspect: '4:3', locale: 'en-GB' });
    expect(deck.slides[0]?.title).toBe('Northwind');
    for (const slide of deck.slides) {
      expect(resolveSlideTheme(deck, slide)).toEqual({
        kind: 'catalog',
        id: 'emerald',
        mode: 'dark',
      });
    }
    expect(createDeckFromTemplate('report', { themeRef: 'sepia-print' }).meta.themeRef).toEqual({
      kind: 'catalog',
      id: 'sepia-print',
    });
  });

  it('replaces placeholder images by slot', () => {
    const deck = createDeckFromTemplate('review', {
      images: { demo: { src: 'assets/export.png', alt: 'Export dialog', width: 800, height: 450 } },
    });
    const demo = deck.slides.find((slide) => slide.id === 'demo');
    expect(demo?.blocks[0]).toMatchObject({
      type: 'figure',
      src: 'assets/export.png',
      alt: 'Export dialog',
    });
  });

  it('returns a fresh deck on every call', () => {
    const first = createDeckFromTemplate('report');
    first.slides.pop();
    expect(createDeckFromTemplate('report').slides).toHaveLength(6);
  });

  it('refuses options that make the deck invalid', () => {
    expect(() => createDeckFromTemplate('report', { title: 'Two\nlines' })).toThrow(TypeError);
    expect(() => createDeckFromTemplate('pitch', { locale: 'not a tag' })).toThrow(/meta.locale/);
    expect(() => createDeckFromTemplate('review', { themeRef: 'Not An Id' })).toThrow(/themeRef/);
    expect(() =>
      createDeckFromTemplate('report', {
        images: { chart: { src: 'javascript:alert(1)', alt: 'x', width: 1, height: 1 } },
      })
    ).toThrow(TypeError);
    expect(() => createDeckFromTemplate('slides' as DeckTemplateId)).toThrow(
      /Unknown deck template/
    );
  });

  it('exports through PPTX, reporting what it leaves out', () => {
    expect(buildDeckPptx(createDeckFromTemplate('report')).omitted).toEqual([
      { slideId: 'numbers', blockType: 'kpi', path: '$[0]' },
      { slideId: 'trend', blockType: 'figure', path: '$[0]' },
    ]);
    expect(buildDeckPptx(createDeckFromTemplate('pitch')).omitted).toEqual([
      { slideId: 'solution', blockType: 'image', path: '$[1]' },
      { slideId: 'proof', blockType: 'stat', path: '$[0]' },
    ]);
    expect(buildDeckPptx(createDeckFromTemplate('review')).omitted).toEqual([
      { slideId: 'goals', blockType: 'checklist', path: '$[0]' },
      { slideId: 'demo', blockType: 'figure', path: '$[0]' },
    ]);
  });
});
