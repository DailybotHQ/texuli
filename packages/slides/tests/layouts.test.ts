// @vitest-environment happy-dom
/**
 * T-layouts-backgrounds: the 20 catalog layout renderers on the stage, the v1
 * masters on free slides, and the background contrast guarantee.
 *
 * - every catalog layout has a lazy renderer, and each one paints its
 *   catalog sample inside `DeckStage` (no placeholder);
 * - layout limits hold: past a limit the stage shows diagnostics and paints
 *   nothing, at the limit it paints;
 * - prop steps hide and reveal through the stage's step host;
 * - layout media and links follow the URL policy at the host's tier;
 * - every background keeps text at 4.5:1 or more on every library theme, in
 *   light and dark, and hostile background sources never paint.
 */
import { render, waitFor } from '@testing-library/svelte';
import {
  compositeOver,
  contrastRatio,
  DECK_BACKGROUND_PRESET_IDS,
  DECK_CATALOG_LAYOUT_IDS,
  DECK_LAYOUTS,
  DECK_TEXT_CONTRAST_MIN,
  type DeckCatalogLayoutId,
  parseDeck,
  resolveDeckBackground,
} from '@texuli/deck/model';
import { loadAllFullLibraryThemes } from '@texuli/tokens/library-expand';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  DECK_BACKGROUND_GALLERY,
  deckBackgroundContrast,
  deckBackgroundPaletteFor,
} from '../src/backgrounds/index.ts';
import {
  fitFontSize,
  fitScale,
  initials,
  LAYOUT_RENDERER_ENTRIES,
  LAYOUT_RENDERER_IDS,
  layoutCtaBlock,
  layoutImageSrc,
  layoutRenderers,
  textOverflows,
} from '../src/layouts/index.ts';
import DeckStage from '../src/stage/DeckStage.svelte';
import { loadDefaultDeckRenderers } from '../src/stage/defaults.ts';
import { scenario } from './scenario.ts';

// The default renderer tables load on first use; preload them, as a host that paints at once does.
beforeAll(() => loadDefaultDeckRenderers());

type Bag = Record<string, unknown>;

function deckOf(slides: unknown[], extra: Bag = {}) {
  return { formatVersion: 2, meta: { title: 'Layout gallery' }, ...extra, slides };
}

function layoutSlide(
  id: DeckCatalogLayoutId,
  props: unknown = DECK_LAYOUTS[id].sample,
  extra = {}
) {
  return { id: `s-${id}`, layout: id, props: structuredClone(props), ...extra };
}

/** A string the sample shows on screen (its title, quote, number or caption). */
function sampleText(id: DeckCatalogLayoutId): string {
  const props = DECK_LAYOUTS[id].sample as Bag;
  for (const key of ['title', 'quote', 'number', 'caption', 'body']) {
    const value = props[key];
    if (typeof value === 'string') return value;
  }
  throw new Error(`no visible text in the ${id} sample`);
}

function mount(deck: unknown, props: Bag = {}) {
  return render(DeckStage, {
    props: { deck, renderers: layoutRenderers, syncHash: false, loadTheme: null, ...props },
  });
}

const activeSlide = (root: ParentNode) =>
  root.querySelector<HTMLElement>('[data-tx-deck-active="true"]') as HTMLElement;

async function painted(root: ParentNode, layout: string): Promise<HTMLElement> {
  return waitFor(() => {
    const frame = activeSlide(root)?.querySelector<HTMLElement>(
      `[data-tx-deck-design="${layout}"]`
    );
    if (!frame) throw new Error(`${layout} not painted yet`);
    return frame;
  });
}

describe('layout renderer table', () => {
  it('answers every catalog layout with a lazy renderer, and nothing else', async () => {
    expect([...LAYOUT_RENDERER_IDS].sort()).toEqual([...DECK_CATALOG_LAYOUT_IDS].sort());
    for (const id of DECK_CATALOG_LAYOUT_IDS) {
      const entry = layoutRenderers.layout?.(layoutSlide(id) as never, { tier: 'untrusted' });
      expect(entry, id).toBe(LAYOUT_RENDERER_ENTRIES[id]);
      const loaded = await LAYOUT_RENDERER_ENTRIES[id].load();
      expect(typeof ('default' in loaded ? loaded.default : loaded), id).toBe('function');
    }
    for (const layout of ['free', 'component', 'custom', 'constructor', '__proto__']) {
      expect(layoutRenderers.layout?.({ layout } as never, { tier: 'untrusted' })).toBeUndefined();
    }
    await expect(layoutRenderers.prefetch?.(layoutSlide('quote') as never)).resolves.toBeTruthy();
    expect(layoutRenderers.prefetch?.({ layout: 'free' } as never)).toBeUndefined();
  });
});

describe('every layout renders its sample on the stage', () => {
  it('paints each of the 20 catalog samples with its text and no placeholder', async () => {
    for (const id of DECK_CATALOG_LAYOUT_IDS) {
      await scenario(id, async () => {
        const { container } = mount(deckOf([layoutSlide(id)]), { tier: 'developer' });
        const frame = await painted(container, id);
        expect(activeSlide(container).dataset.txDeckLayout).toBe(id);
        await waitFor(() => expect(frame.textContent).toContain(sampleText(id)));
        expect(container.querySelector('[data-tx-deck-invalid]')).toBeNull();
        expect(container.textContent).not.toContain('is not available in this stage yet');
        // Text is text: no markup from props reaches the DOM.
        expect(frame.querySelector('script, iframe, object, embed')).toBeNull();
      });
    }
  });

  it('paints block-shaped props through the block families (code highlights step)', async () => {
    await scenario('code', async () => {
      const props = {
        ...DECK_LAYOUTS['code-with-callout'].sample,
        code: {
          lang: 'ts',
          source: 'const a = 1;\nconst b = 2;\nconst c = 3;',
          highlights: ['1', '2-3'],
        },
      };
      const { container } = mount(deckOf([layoutSlide('code-with-callout', props)]));
      const frame = await painted(container, 'code-with-callout');
      await waitFor(() => expect(frame.querySelector('[data-tx-block="code"]')).not.toBeNull());
      expect(activeSlide(container).dataset.stepCount).toBe('1');
    });
    await scenario('chart', async () => {
      const { container } = mount(deckOf([layoutSlide('chart')]));
      const frame = await painted(container, 'chart');
      await waitFor(() => expect(frame.querySelector('[data-tx-block="chart"]')).not.toBeNull());
      const table = frame.querySelector('table.data, [data-slot="chart"] table');
      expect(table?.textContent).toContain('Releases');
      expect(table?.textContent).toContain('31');
    });
  });
});

describe('layout limits', () => {
  const cases: [DeckCatalogLayoutId, (props: Bag) => Bag, (props: Bag) => Bag][] = [
    [
      'three-column-cards',
      (p) => ({ ...p, cards: [...(p.cards as unknown[]), (p.cards as unknown[])[0]] }),
      (p) => p,
    ],
    [
      'title-hero',
      (p) => ({ ...p, title: 'x'.repeat(101) }),
      (p) => ({ ...p, title: 'x'.repeat(100) }),
    ],
    [
      'comparison-table',
      (p) => ({ ...p, rows: [...(p.rows as unknown[]), ...(p.rows as unknown[])] }),
      (p) => ({ ...p, rows: [...(p.rows as unknown[]), ...(p.rows as unknown[]).slice(0, 2)] }),
    ],
    [
      'team-avatars',
      (p) => ({ ...p, people: Array.from({ length: 9 }, (_, i) => ({ name: `Person ${i}` })) }),
      (p) => ({ ...p, people: Array.from({ length: 8 }, (_, i) => ({ name: `Person ${i}` })) }),
    ],
  ];

  it('refuses a layout past its limit (diagnostics, nothing painted) and paints at the limit', async () => {
    for (const [id, past, at] of cases) {
      const sample = structuredClone(DECK_LAYOUTS[id].sample) as Bag;
      await scenario(`${id} past the limit`, async () => {
        const deck = deckOf([layoutSlide(id, past(sample))]);
        expect(parseDeck(deck).ok).toBe(false);
        const { container } = mount(deck);
        await waitFor(() =>
          expect(container.querySelector('[data-tx-deck-invalid]')).not.toBeNull()
        );
        expect(container.querySelector(`[data-tx-deck-design="${id}"]`)).toBeNull();
      });
      await scenario(`${id} at the limit`, async () => {
        const deck = deckOf([layoutSlide(id, at(sample))]);
        expect(parseDeck(deck).ok).toBe(true);
        const { container } = mount(deck);
        await painted(container, id);
      });
    }
  });

  it('shrinks text and content within the floors (fit helpers)', () => {
    expect(fitScale(800, 600, 0.75)).toBe(0.75);
    expect(fitScale(620, 600, 0.75)).toBe(0.967);
    expect(fitScale(601, 600, 0.75)).toBe(1);
    expect(fitScale(0, 600, 0.75)).toBe(1);
    const size = fitFontSize(112, 56, (candidate) => candidate > 80);
    expect(size).toBeLessThanOrEqual(80);
    expect(size).toBeGreaterThanOrEqual(56);
    expect(fitFontSize(112, 56, () => true)).toBe(56);
    const box = { scrollHeight: 200, clientHeight: 100, scrollWidth: 10, clientWidth: 10 };
    expect(textOverflows(box, 40)).toBe(true);
    expect(textOverflows({ ...box, scrollHeight: 110 }, 40)).toBe(false);
  });
});

describe('prop steps', () => {
  it('hides stepped process steps until their step and reveals them in order', async () => {
    const props = structuredClone(DECK_LAYOUTS['process-steps'].sample) as {
      steps: Bag[];
    } & Bag;
    props.steps = props.steps.map((step, index) => (index === 0 ? step : { ...step, step: index }));
    const deck = deckOf([layoutSlide('process-steps', props)]);
    for (const step of [0, 1, 3]) {
      await scenario(`step ${step}`, async () => {
        const { container } = mount(deck, { initialSlideId: 's-process-steps', initialStep: step });
        const frame = await painted(container, 'process-steps');
        const items = [...frame.querySelectorAll<HTMLElement>('[data-slot="step"]')];
        expect(items).toHaveLength(props.steps.length);
        expect(items[0]?.dataset.txDeckFragment).toBeUndefined();
        for (let index = 1; index < items.length; index += 1) {
          const item = items[index] as HTMLElement;
          const shown = index <= step;
          expect(item.dataset.txDeckFragment, `item ${index}`).toBe(shown ? 'visible' : 'hidden');
          expect(item.getAttribute('aria-hidden'), `item ${index}`).toBe(shown ? null : 'true');
        }
      });
    }
  });

  it('reveals the whole body from a marker on the props root', async () => {
    const deck = deckOf([
      layoutSlide('big-stat', { ...DECK_LAYOUTS['big-stat'].sample, step: 1, fragment: 'fade-up' }),
    ]);
    await scenario('root marker', async () => {
      const { container } = mount(deck);
      const frame = await painted(container, 'big-stat');
      const body = frame.querySelector<HTMLElement>('.tx-deck-layout__body');
      expect(body?.dataset.txDeckFragment).toBe('hidden');
      expect(body?.dataset.txDeckEffect).toBe('fade-up');
    });
  });
});

describe('layout media and links at the host tier', () => {
  const PNG =
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

  it('applies the image policy per tier, and avatars through the host adapter only', () => {
    expect(layoutImageSrc('https://example.com/a.webp', 'untrusted')).toBe(
      'https://example.com/a.webp'
    );
    expect(layoutImageSrc('assets/a.webp', 'untrusted')).toBe('assets/a.webp');
    expect(layoutImageSrc(PNG, 'untrusted')).toBeUndefined();
    expect(layoutImageSrc(PNG, 'developer')).toBe(PNG);
    for (const hostile of [
      'javascript:alert(1)',
      '//evil.example/a.png',
      'http://example.com/a.png',
    ]) {
      expect(layoutImageSrc(hostile, 'untrusted'), hostile).toBeUndefined();
    }
    expect(layoutImageSrc('av-001', 'untrusted')).toBeUndefined();
    expect(layoutImageSrc('av-001', 'untrusted', (id) => `https://example.com/${id}.webp`)).toBe(
      'https://example.com/av-001.webp'
    );
    expect(
      layoutImageSrc('avatar:av-002', 'untrusted', () => 'javascript:alert(1)')
    ).toBeUndefined();
    expect(initials('Ada Example')).toBe('AE');
    expect(initials('  Marco  ')).toBe('M');
  });

  it('shows the refused-media notice in the frame for a source the tier refuses', async () => {
    const props = {
      ...DECK_LAYOUTS['image-left'].sample,
      image: { ...DECK_LAYOUTS['image-left'].sample.image, src: PNG },
    };
    await scenario('untrusted data: image', async () => {
      const { container } = mount(deckOf([layoutSlide('image-left', props)]));
      const frame = await painted(container, 'image-left');
      expect(frame.querySelector('[data-refused="src"]')?.textContent).toContain('not shown');
      expect(frame.querySelector('img')).toBeNull();
    });
    await scenario('developer data: image', async () => {
      const { container } = mount(deckOf([layoutSlide('image-left', props)]), {
        tier: 'developer',
      });
      const frame = await painted(container, 'image-left');
      await waitFor(() => expect(frame.querySelector('img')?.getAttribute('src')).toBe(PNG));
    });
    await scenario('team without an avatar adapter shows initials', async () => {
      const { container } = mount(deckOf([layoutSlide('team-avatars')]));
      const frame = await painted(container, 'team-avatars');
      expect(frame.querySelectorAll('[data-avatar="initials"]')).toHaveLength(2);
      expect(frame.textContent).toContain('AE');
    });
  });

  it('refuses unsafe CTA links at parse and in the block schema', () => {
    for (const href of ['javascript:alert(1)', '//evil.example', 'http://example.com']) {
      const props = { ...DECK_LAYOUTS['closing-cta'].sample, cta: { label: 'Go', href } };
      expect(parseDeck(deckOf([layoutSlide('closing-cta', props)])).ok, href).toBe(false);
      expect(layoutCtaBlock({ label: 'Go', href }), href).toBeNull();
    }
    expect(layoutCtaBlock({ label: 'Docs', href: 'https://example.com/docs' })).not.toBeNull();
  });
});

describe('v1 masters on free slides', () => {
  it('renders a migrated v1 deck through the stage regions with the layouts table installed', async () => {
    const v1 = {
      meta: { title: 'Harborline review', aspect: '16:9' },
      masters: ['title', 'two-column', 'quote'],
      slides: [
        {
          id: 'compare',
          title: 'Before and after',
          master: 'two-column',
          blocks: [
            { type: 'text', markdown: 'Manual manifests' },
            { type: 'divider' },
            { type: 'text', markdown: 'Generated manifests' },
          ],
        },
        {
          id: 'voice',
          master: 'quote',
          blocks: [
            { type: 'quote', quote: 'It just ships.' },
            { type: 'divider' },
            { type: 'text', markdown: 'Fictional customer' },
          ],
        },
      ],
    };
    await scenario('two-column master', async () => {
      const { container } = mount(v1);
      await waitFor(() =>
        expect(activeSlide(container)?.querySelector('[data-master="two-column"]')).toBeTruthy()
      );
      const regions = activeSlide(container).querySelector(
        '[data-master="two-column"]'
      ) as HTMLElement;
      expect(regions.dataset.slots).toBe('contentStart contentEnd');
      await waitFor(() => expect(regions.textContent).toContain('Generated manifests'));
    });
    await scenario('quote master', async () => {
      const { container } = mount(v1, { initialSlideId: 'voice' });
      await waitFor(() =>
        expect(
          activeSlide(container)?.querySelector('[data-master="quote"]')?.getAttribute('data-slots')
        ).toBe('quote attribution')
      );
    });
  });
});

describe('backgrounds keep text contrast', () => {
  it('has the 13 presets and one spec of each media kind in the gallery', () => {
    const presets = DECK_BACKGROUND_GALLERY.filter((entry) => typeof entry.background === 'string');
    expect(presets.map((entry) => entry.background)).toEqual([...DECK_BACKGROUND_PRESET_IDS]);
    expect(DECK_BACKGROUND_GALLERY.length).toBe(17);
    for (const entry of DECK_BACKGROUND_GALLERY) {
      const deck = deckOf([
        { id: entry.id, layout: 'quote', props: { quote: 'Q' }, background: entry.background },
      ]);
      expect(parseDeck(deck).ok, entry.id).toBe(true);
    }
  });

  it('holds 4.5:1 on every background for every library theme in light and dark', async () => {
    const themes = await loadAllFullLibraryThemes();
    expect(themes.length).toBeGreaterThan(100);
    let checked = 0;
    for (const theme of themes) {
      for (const mode of ['light', 'dark'] as const) {
        const palette = deckBackgroundPaletteFor(theme, mode);
        for (const entry of deckBackgroundContrast(theme, mode)) {
          checked += 1;
          expect(entry.passes, `${theme.id} ${mode} ${JSON.stringify(entry.background)}`).toBe(
            true
          );
          // Recompute solid backgrounds independently: ink over the color under its scrim.
          const base = entry.resolved.layers.find((layer) => layer.type === 'color');
          if (base && 'color' in base && entry.resolved.kind === 'solid') {
            const seen =
              entry.resolved.scrim > 0
                ? compositeOver(base.color, entry.resolved.scrimColor, entry.resolved.scrim)
                : base.color;
            expect(contrastRatio(entry.resolved.textColor, seen)).toBeGreaterThanOrEqual(
              DECK_TEXT_CONTRAST_MIN - 0.01
            );
          }
        }
        expect(palette.background).toMatch(/^#[0-9a-f]{3,6}$/i);
      }
    }
    expect(checked).toBe(themes.length * 2 * DECK_BACKGROUND_GALLERY.length);
    // 200+ themes × 2 modes × every background: CPU-bound, so slow on a loaded host.
  }, 30_000);

  it('never paints a hostile background source, and refuses data: media at the untrusted tier', async () => {
    for (const src of [
      'javascript:alert(1)',
      'http://example.com/a.png',
      '//evil.example/a.png',
      'https://example.com/a.svg',
      '../secret.png',
    ]) {
      const deck = deckOf([
        { id: 'a', layout: 'quote', props: { quote: 'Q' }, background: { kind: 'image', src } },
      ]);
      expect(parseDeck(deck).ok, src).toBe(false);
    }
    const spec = DECK_BACKGROUND_GALLERY.find((entry) => entry.id === 'bg-spec-image');
    const PNG = (spec?.background as { src: string } | undefined)?.src ?? '';
    expect(PNG).toMatch(/^data:image\/png;base64,/);
    const deck = deckOf([
      { id: 'a', layout: 'quote', props: { quote: 'Q' }, background: { kind: 'image', src: PNG } },
    ]);
    await scenario('untrusted', async () => {
      const { container } = mount(deck);
      await painted(container, 'quote');
      const layer = activeSlide(container).querySelector<HTMLElement>('.tx-deck-stage__background');
      expect(layer?.dataset.txDeckBgRefused).toBe('src');
      expect(layer?.querySelector('img')).toBeNull();
      // The scrim still guarantees the text contrast over any pixel.
      expect(activeSlide(container).dataset.txDeckBgTone).toBeTruthy();
    });
    await scenario('developer', async () => {
      const { container } = mount(deck, { tier: 'developer' });
      await painted(container, 'quote');
      const image = activeSlide(container).querySelector('.tx-deck-stage__background img');
      expect(image?.getAttribute('src')).toBe(PNG);
    });
    const resolved = resolveDeckBackground(
      { kind: 'image', src: PNG },
      deckBackgroundPaletteFor(null, 'light')
    );
    expect(resolved.contrast).toBeGreaterThanOrEqual(DECK_TEXT_CONTRAST_MIN);
    expect(resolved.scrim).toBeGreaterThan(0);
  });
});
