// @vitest-environment happy-dom
import { fireEvent, render, waitFor } from '@testing-library/svelte';
import { buildCatalog, type ManifestGroup } from '@texuli/catalog/build';
import { CHAT_MANIFESTS } from '@texuli/catalog/manifests/chat';
import { COMPOSITION_MANIFESTS } from '@texuli/catalog/manifests/composition';
import { CONTENT_MANIFESTS } from '@texuli/catalog/manifests/content';
import { DATA_MANIFESTS } from '@texuli/catalog/manifests/data';
import { DISPLAY_MANIFESTS } from '@texuli/catalog/manifests/display';
import { FORMS_MANIFESTS } from '@texuli/catalog/manifests/forms';
import { LAYOUTS_MANIFESTS } from '@texuli/catalog/manifests/layouts';
import { OVERLAYS_MANIFESTS } from '@texuli/catalog/manifests/overlays';
import { STATE_MANIFESTS } from '@texuli/catalog/manifests/state';
import { WORKFLOWS_MANIFESTS } from '@texuli/catalog/manifests/workflows';
import type { Deck, DeckSlide, FreeSlide as FreeSlideModel } from '@texuli/deck/model';
import { PLAYER_LOADERS } from '@texuli/player';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import FreeSlide from '../src/components/FreeSlide.svelte';
import {
  BLOCK_FAMILY_IDS,
  componentRenderers,
  SLIDE_COMPONENT_EXCLUSIONS,
  SLIDE_COMPONENTS,
  SLIDE_EXCLUDED_GROUPS,
  slideComponentSupport,
} from '../src/registry/index.ts';
import DeckStage from '../src/stage/DeckStage.svelte';
import { loadDefaultDeckRenderers } from '../src/stage/defaults.ts';
import { createDeckTranslator } from '../src/stage/messages.ts';
import { prepareDeck } from '../src/stage/prepare.ts';
import { deckSlideSteps, deckStepView } from '../src/stage/steps.ts';
import { clearDeckHash } from './scenario.ts';

// The default renderer tables load on first use; preload them, as a host that paints at once does.
beforeAll(() => loadDefaultDeckRenderers());

type Bag = Record<string, unknown>;

const GROUPS: readonly ManifestGroup[] = [
  { name: 'chat', manifests: CHAT_MANIFESTS },
  { name: 'composition', manifests: COMPOSITION_MANIFESTS },
  { name: 'content', manifests: CONTENT_MANIFESTS },
  { name: 'data', manifests: DATA_MANIFESTS },
  { name: 'display', manifests: DISPLAY_MANIFESTS },
  { name: 'forms', manifests: FORMS_MANIFESTS },
  { name: 'layouts', manifests: LAYOUTS_MANIFESTS },
  { name: 'overlays', manifests: OVERLAYS_MANIFESTS },
  { name: 'state', manifests: STATE_MANIFESTS },
  { name: 'workflows', manifests: WORKFLOWS_MANIFESTS },
];

const entries = (await buildCatalog(GROUPS)).catalog.entries;

/** Ids happy-dom cannot paint (browser e2e covers them); they still validate. */
const DOM_LIMITS: Readonly<Record<string, string>> = {
  'media-composition-canvas': 'happy-dom has no 2D canvas context',
};

/**
 * Ids whose example props nest deeper than the deck model's component props
 * cap (`boundedProps`, depth 4 in `@texuli/deck`): `parseDeck` refuses them
 * today (an open issue for the model), so they are painted here through the
 * registry's free-slide renderer without the parse step, with the same steps.
 */
// Component props allow depth 8 (deck model `componentProps`), so every
// slide component, workflow graphs included, now passes the parse step.
const MODEL_DEPTH_LIMITED: Readonly<Record<string, string>> = {};

/** Paint items on a free slide through the registry's free renderer (no parse step). */
function renderWithoutParse(items: Bag[], step: number) {
  const slide = { id: 'components', layout: 'free', blocks: items } as unknown as FreeSlideModel;
  const deck = { formatVersion: 2, meta: { title: 'T' }, slides: [slide] } as unknown as Deck;
  return render(FreeSlide, {
    props: {
      slide,
      context: {
        deck,
        index: 0,
        active: true,
        tier: 'untrusted',
        t: createDeckTranslator(),
        step: deckStepView({
          slide: slide as DeckSlide,
          steps: deckSlideSteps(slide as DeckSlide),
          step,
        }),
        canvas: { width: 1280, height: 720 },
        renderers: [componentRenderers],
      },
    },
  });
}

/** What an example needs on a slide: a choice's options (its enum is inferred from them). */
function declared(id: string, props: Bag): Bag {
  if (id === 'control-choice' && typeof props.state === 'string') {
    return { ...props, options: ['this-week', 'last-week'] };
  }
  return props;
}

function deckWith(items: Bag[]): Bag {
  return {
    formatVersion: 2,
    meta: { title: 'Components' },
    slides: [
      { id: 'components', layout: 'free', blocks: items },
      { id: 'after', layout: 'free', blocks: [{ type: 'text', markdown: 'After' }] },
    ],
  };
}

function mockPreferences(): void {
  vi.spyOn(window, 'matchMedia').mockImplementation(
    (query: string) =>
      ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(() => false),
      }) as unknown as MediaQueryList
  );
}

afterEach(() => {
  vi.restoreAllMocks();
  clearDeckHash();
});

describe('slide components: coverage of the catalog', () => {
  it('classifies every catalog id exactly once: slide component, excluded id or excluded group', () => {
    const groups = Object.values(SLIDE_EXCLUDED_GROUPS).flatMap((group) => group.ids);
    const tables = [Object.keys(SLIDE_COMPONENTS), Object.keys(SLIDE_COMPONENT_EXCLUSIONS), groups];
    const all = tables.flat();
    expect(new Set(all).size).toBe(all.length);
    expect(entries.length).toBe(162);
    for (const entry of entries) {
      expect(slideComponentSupport(entry.id).kind, entry.id).not.toBe('unknown');
    }
    for (const id of all)
      expect(
        entries.some((entry) => entry.id === id),
        id
      ).toBe(true);
  });

  it('paints every player-painted id or excludes it with a reason', () => {
    for (const id of Object.keys(PLAYER_LOADERS)) {
      const support = slideComponentSupport(id);
      expect(support.kind === 'component' || support.kind === 'excluded', id).toBe(true);
    }
    // Ids with no player painter are excluded by group, never claimed as slide components.
    for (const id of Object.keys(SLIDE_COMPONENTS))
      expect(Object.hasOwn(PLAYER_LOADERS, id), id).toBe(true);
    for (const [id, reason] of Object.entries(SLIDE_COMPONENT_EXCLUSIONS)) {
      expect(reason.length, id).toBeGreaterThan(40);
    }
    for (const group of Object.values(SLIDE_EXCLUDED_GROUPS)) {
      expect(group.reason.length).toBeGreaterThan(40);
      for (const id of group.ids) expect(Object.hasOwn(PLAYER_LOADERS, id), id).toBe(false);
    }
  });

  it('covers all nine @texuli/blocks families, each its own lazy chunk', () => {
    expect(Object.keys(BLOCK_FAMILY_IDS).sort()).toEqual([
      'code',
      'data',
      'diagram',
      'embed',
      'interactive',
      'map',
      'media',
      'structure',
      'text',
    ]);
    for (const id of Object.values(BLOCK_FAMILY_IDS)) {
      expect(SLIDE_COMPONENTS[id]?.family).toBe(id);
    }
  });

  it('declares steppable paths, families and capabilities for every slide component', () => {
    for (const [id, info] of Object.entries(SLIDE_COMPONENTS)) {
      expect(info.stepPaths.length, id).toBeGreaterThan(0);
      expect(info.stepPaths, id).toContain('');
    }
    expect(SLIDE_COMPONENTS['sortable-list']?.capability).toBe('reorder');
    expect(SLIDE_COMPONENTS['workflow-graph']?.capability).toBe('workflow-edit');
    expect(SLIDE_COMPONENTS['blocks-embed']?.capability).toBe('embeds');
  });
});

const painted = entries.filter((entry) => Object.hasOwn(SLIDE_COMPONENTS, entry.id));

describe('slide components: every one renders on a slide with steps', () => {
  it('has the catalog examples to paint', () => {
    expect(painted.length).toBe(Object.keys(SLIDE_COMPONENTS).length);
    for (const entry of painted) expect(entry.examples.length, entry.id).toBeGreaterThan(0);
  });

  for (const entry of painted) {
    const limit = DOM_LIMITS[entry.id];
    it.skipIf(limit !== undefined)(
      `${entry.id}${limit ? ` (paint skipped: ${limit})` : ''}`,
      { timeout: 30_000 },
      async () => {
        mockPreferences();
        const items = entry.examples.map((example, i) => ({
          type: 'component',
          component: entry.id,
          id: `item-${i}`,
          step: i + 1,
          fragment: 'fade-up',
          props: declared(entry.id, example.props as Bag),
        }));
        if (Object.hasOwn(MODEL_DEPTH_LIMITED, entry.id)) {
          const parsed = prepareDeck(deckWith(items), componentRenderers);
          expect(parsed.issues.map((issue) => issue.code)).toContain('too-deep');
          for (const step of [0, 1]) {
            const { container, unmount } = renderWithoutParse(items, step);
            await waitFor(
              () => {
                expect(container.querySelectorAll('[data-tx-player]').length).toBe(items.length);
                expect(container.querySelector('[data-tx-player-skeleton]')).toBeNull();
              },
              { timeout: 20_000 }
            );
            for (const player of container.querySelectorAll<HTMLElement>('[data-tx-player]')) {
              expect(player.dataset.status).not.toBe('invalid');
              expect(player.querySelector('.tx-player__notice')).toBeNull();
            }
            const first = container.querySelector<HTMLElement>('[data-tx-deck-item="0"]');
            expect(first?.dataset.txDeckFragment).toBe(step === 0 ? 'hidden' : 'visible');
            unmount();
          }
          return;
        }
        const issues: unknown[] = [];
        const { container } = render(DeckStage, {
          props: {
            deck: deckWith(items),
            loadTheme: null,
            renderers: componentRenderers,
            onError: (error: unknown) => issues.push(error),
          },
        });
        expect(issues).toEqual([]);
        await waitFor(
          () => {
            const nodes = container.querySelectorAll('[data-tx-deck-component]');
            expect(nodes.length).toBe(items.length);
            expect(container.querySelector('[data-tx-player-skeleton]')).toBeNull();
            expect(container.querySelector('.tx-deck-stage__loading')).toBeNull();
          },
          { timeout: 20_000 }
        );
        const slide = container.querySelector<HTMLElement>('[data-slide-id="components"]');
        const players = [...(slide?.querySelectorAll<HTMLElement>('[data-tx-player]') ?? [])];
        expect(players.length).toBe(items.length);
        for (const player of players) {
          expect(player.dataset.status, player.outerHTML.slice(0, 600)).not.toBe('invalid');
          expect(player.querySelector('[data-tx-player-error]'), entry.id).toBeNull();
          expect(
            player.querySelector('.tx-player__notice'),
            player.textContent?.slice(0, 300)
          ).toBeNull();
        }
        // Steps: every item starts hidden, then the first one reveals.
        const fragments = () => [
          ...(slide?.querySelectorAll<HTMLElement>('[data-tx-deck-item]') ?? []),
        ];
        expect(fragments().map((item) => item.dataset.txDeckFragment)).toEqual(
          items.map(() => 'hidden')
        );
        expect(fragments()[0]?.getAttribute('aria-hidden')).toBe('true');
        slide?.focus();
        await fireEvent.keyDown(slide as HTMLElement, { key: 'ArrowRight' });
        await waitFor(() => expect(fragments()[0]?.dataset.txDeckFragment).not.toBe('hidden'));
        expect(fragments()[0]?.getAttribute('aria-hidden')).toBeNull();
        expect(fragments()[0]?.dataset.txDeckEffect).toBe('fade-up');
      }
    );
  }
});
