// @vitest-environment happy-dom
import { fireEvent, render, waitFor } from '@testing-library/svelte';
import type { Deck, DeckSlide, FreeSlide as FreeSlideModel } from '@texuli/deck/model';
import type { Component } from 'svelte';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import FreeSlide from '../src/components/FreeSlide.svelte';
import MathBlock from '../src/components/MathBlock.svelte';
import {
  componentBlueprint,
  componentRenderers,
  componentState,
  createComponentRenderers,
  createMemoryStateHost,
  extendedItem,
  gatedProps,
  registryOptions,
  type SlideComponentPainterProps,
  slideStateKey,
  validateSlideBlock,
  validateSlideComponent,
} from '../src/registry/index.ts';
import DeckStage from '../src/stage/DeckStage.svelte';
import { loadDefaultDeckRenderers } from '../src/stage/defaults.ts';
import { createDeckTranslator } from '../src/stage/messages.ts';
import { prepareDeck } from '../src/stage/prepare.ts';
import type { DeckRenderers, DeckSlideRenderContext } from '../src/stage/renderers.ts';
import { deckSlideSteps, deckStepView } from '../src/stage/steps.ts';
import { clearDeckHash } from './scenario.ts';

// The default renderer tables load on first use; preload them, as a host that paints at once does.
beforeAll(() => loadDefaultDeckRenderers());

type Bag = Record<string, unknown>;

const PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

const WORKFLOW = {
  label: 'Expense approval',
  mode: 'view',
  graph: {
    version: 1,
    cycles: 'forbid',
    nodeTypes: [
      {
        id: 'step',
        label: 'Step',
        ports: [
          { id: 'in', direction: 'in' },
          { id: 'out', direction: 'out', multiple: true },
        ],
      },
    ],
    nodes: [
      { id: 'ask', type: 'step', label: 'Request', position: { x: 0, y: 0 } },
      { id: 'pay', type: 'step', label: 'Pay', position: { x: 260, y: 0 } },
    ],
    edges: [{ id: 'e1', from: { node: 'ask', port: 'out' }, to: { node: 'pay', port: 'in' } }],
  },
};

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

/**
 * A host painter for the override tests: a Svelte 5 component is a function
 * of an anchor node and its props. It writes text only.
 */
const HostPainter = ((anchor: Node, props: SlideComponentPainterProps) => {
  const note = document.createElement('p');
  note.dataset.hostPainter = props.id;
  note.textContent = `${props.id} ${props.stateKey}`;
  anchor.parentNode?.insertBefore(note, anchor);
}) as unknown as Component<SlideComponentPainterProps>;

afterEach(() => {
  vi.restoreAllMocks();
  clearDeckHash();
});

/** A free slide painted by the registry's free renderer outside a stage (no parse step). */
function renderFree(
  blocks: Bag[],
  options: { step?: number; tier?: 'untrusted' | 'developer'; renderers?: DeckRenderers } = {}
) {
  const slide = { id: 'free', layout: 'free', blocks } as unknown as FreeSlideModel;
  const deck = { formatVersion: 2, meta: { title: 'T' }, slides: [slide] } as unknown as Deck;
  const steps = deckSlideSteps(slide as DeckSlide);
  const context: DeckSlideRenderContext = {
    deck,
    index: 0,
    active: true,
    tier: options.tier ?? 'untrusted',
    t: createDeckTranslator(),
    step: deckStepView({ slide: slide as DeckSlide, steps, step: options.step ?? 0 }),
    canvas: { width: 1280, height: 720 },
    renderers: [options.renderers ?? componentRenderers],
  };
  return render(FreeSlide, { props: { slide, context } });
}

describe('registry: the renderer table', () => {
  it('answers component and item slides it paints, and only extended free slides', () => {
    const lookup = { tier: 'untrusted' as const };
    const item = (component: string) => ({ type: 'component', component, props: {} }) as never;
    expect(componentRenderers.item?.(item('charts-bar'), lookup)).toBeTruthy();
    expect(componentRenderers.item?.(item('dialog'), lookup)).toBeNull();
    expect(componentRenderers.item?.(item('nope'), lookup)).toBeNull();
    const free = (blocks: Bag[]) => ({ id: 'f', layout: 'free', blocks }) as never;
    expect(componentRenderers.free?.(free([{ type: 'text', markdown: 'Hi' }]), lookup)).toBeNull();
    expect(componentRenderers.free?.(free([{ type: 'math', tex: 'x' }]), lookup)).toBeTruthy();
    expect(
      componentRenderers.free?.(free([{ type: 'image', src: 'a.png', alt: 'A' }]), lookup)
    ).toBeTruthy();
    expect(componentRenderers.free?.(free([{ type: 'terminal', lines: [] }]), lookup)).toBeTruthy();
  });

  it('feeds parseDeck: excluded ids get their reason; props are checked at paint, or at parse on request', async () => {
    const deck = (component: string, props: Bag) => ({
      formatVersion: 2,
      meta: { title: 'T' },
      slides: [{ id: 's', layout: 'free', blocks: [{ type: 'component', component, props }] }],
    });
    const excluded = prepareDeck(deck('dialog', { title: 'x' }), componentRenderers);
    expect(excluded.ok).toBe(false);
    expect(excluded.issues.map((issue) => issue.code)).toContain('component-excluded');
    expect(excluded.issues.find((issue) => issue.code === 'component-excluded')?.message).toMatch(
      /focus trap/
    );
    const unknown = prepareDeck(deck('made-up', {}), componentRenderers);
    expect(unknown.issues.map((issue) => issue.code)).toContain('unknown-component');
    // The default table leaves props to the player, which validates at the tier before painting.
    expect(prepareDeck(deck('charts-bar', { title: 42 }), componentRenderers).ok).toBe(true);
    const strict = createComponentRenderers({ validateProps: validateSlideComponent });
    const bad = prepareDeck(deck('charts-bar', { title: 42 }), strict);
    expect(bad.ok).toBe(false);
    expect(bad.issues.map((issue) => issue.code)).toContain('component-props');
    expect(
      prepareDeck(deck('media-image', { src: 'images/team.webp', alt: 'A team' }), strict).ok
    ).toBe(true);
    mockPreferences();
    const { container } = render(DeckStage, {
      props: {
        deck: deck('charts-bar', { title: 42 }),
        loadTheme: null,
        renderers: componentRenderers,
      },
    });
    await waitFor(
      () =>
        expect(container.querySelector('[data-tx-player]')?.getAttribute('data-status')).toBe(
          'invalid'
        ),
      { timeout: 15_000 }
    );
    expect(container.querySelector('.tx-player__notice')).toBeTruthy();
    const good = prepareDeck(
      deck('media-image', { src: 'images/team.webp', alt: 'A team' }),
      componentRenderers
    );
    expect(good.ok).toBe(true);
  });

  it('lets a host replace, add and remove components', async () => {
    mockPreferences();
    const renderers = createComponentRenderers({
      overrides: { 'charts-bar': HostPainter, 'org-chart': HostPainter },
      exclude: ['media-image'],
    });
    expect(renderers.knownComponents).toContain('org-chart');
    expect(renderers.knownComponents).not.toContain('media-image');
    expect(
      renderers.validateComponent?.({ component: 'org-chart', props: { anything: 1 } }, [])
    ).toBeUndefined();
    const { container } = render(DeckStage, {
      props: {
        loadTheme: null,
        renderers,
        deck: {
          formatVersion: 2,
          meta: { title: 'T' },
          slides: [
            {
              id: 's',
              layout: 'free',
              blocks: [
                { type: 'component', component: 'charts-bar', props: { title: 'Q3' } },
                { type: 'component', component: 'org-chart', props: { depth: 2 } },
              ],
            },
          ],
        },
      },
    });
    await waitFor(() => expect(container.querySelectorAll('[data-host-painter]').length).toBe(2));
    expect(container.querySelector('[data-host-painter="charts-bar"]')?.textContent).toBe(
      'charts-bar s/blocks.0'
    );
    expect(container.querySelector('[data-tx-player]')).toBeNull();
  });

  it('finds its options through the stage renderer list', () => {
    const host = createMemoryStateHost();
    const renderers = createComponentRenderers({ stateHost: host });
    expect(registryOptions([{}, renderers]).stateHost).toBe(host);
    expect(registryOptions([{}]).stateHost).not.toBe(host);
    expect(registryOptions([componentRenderers]).capabilities).toEqual({});
  });

  it('prefetches only the chunks a slide needs', async () => {
    expect(
      componentRenderers.prefetch?.({
        id: 't',
        layout: 'free',
        blocks: [{ type: 'text', markdown: 'x' }],
      } as never)
    ).toBeUndefined();
    await expect(
      componentRenderers.prefetch?.({
        id: 'c',
        layout: 'component',
        component: { component: 'charts-bar', props: {} },
      } as never)
    ).resolves.toBeTruthy();
    expect(
      componentRenderers.prefetch?.({ id: 'q', layout: 'quote', props: {} } as never)
    ).toBeUndefined();
  });
});

describe('registry: a component adds no headings to the slide outline', () => {
  const CHART = {
    title: 'Tickets by status',
    description: 'Ticket distribution',
    data: [],
    labels: {},
  };

  /** Headings inside the painted components, except the player's hidden chrome label. */
  const addedHeadings = (root: ParentNode) =>
    [...root.querySelectorAll('[data-tx-deck-component] h1, [data-tx-deck-component] h2')].filter(
      (heading) => !heading.closest('.tx-player__chrome')
    );

  it('ComponentItem and ComponentSlide add no h1 or h2, and the frame is untitled', async () => {
    mockPreferences();
    const deck = {
      formatVersion: 2,
      meta: { title: 'T' },
      slides: [
        {
          id: 'item',
          layout: 'free',
          blocks: [{ type: 'component', component: 'charts-donut', props: CHART }],
        },
        { id: 'whole', layout: 'component', component: { component: 'charts-pie', props: CHART } },
      ],
    };
    const { container } = render(DeckStage, { props: { deck, loadTheme: null } });
    await waitFor(
      () => {
        expect(container.querySelectorAll('[data-tx-deck-component] [data-tx-player]').length).toBe(
          2
        );
        expect(container.querySelector('[data-tx-player-skeleton]')).toBeNull();
      },
      { timeout: 15_000 }
    );
    expect(addedHeadings(container)).toEqual([]);
    for (const frame of container.querySelectorAll<HTMLElement>(
      '[data-tx-deck-component] [data-tx-player-frame]'
    )) {
      expect(frame.querySelector('.tx-player-layout__title')).toBeNull();
      expect(frame.hasAttribute('aria-labelledby')).toBe(false);
    }
    // chrome={false}: the player paints no label heading, skip link or end anchor.
    expect(container.querySelectorAll('[data-tx-deck-component] .tx-player__chrome').length).toBe(
      0
    );
    expect(container.querySelectorAll('[data-tx-deck-component] .tx-player__skip').length).toBe(0);
    expect(container.querySelectorAll('[data-tx-deck-component] .tx-player__end').length).toBe(0);
    for (const player of container.querySelectorAll('[data-tx-deck-component] [data-tx-player]')) {
      expect(player.getAttribute('data-tx-player-chrome')).toBe('off');
    }
    const visibleHeadings = [
      ...container.querySelectorAll('[data-tx-deck-component] h1, [data-tx-deck-component] h2'),
    ].filter((heading) => !heading.closest('[hidden]'));
    expect(visibleHeadings).toEqual([]);

    // The chart's own title stays (an h3 below the slide's heading).
    const h3 = [...container.querySelectorAll('[data-tx-deck-component] h3')].map(
      (h) => h.textContent
    );
    expect(h3.join('|')).toContain('Tickets by status');
  });

  it('the blueprint wraps the node in an untitled document frame', () => {
    const blueprint = componentBlueprint({ id: 'charts-pie', props: CHART });
    expect(blueprint.tree).toEqual({
      id: 'layout-doc',
      props: {},
      children: [{ id: 'charts-pie', props: CHART }],
    });
  });
});

describe('registry: state host and capabilities', () => {
  it('keys state by slide id and path, never by content', () => {
    expect(slideStateKey('intro', ['blocks', 3])).toBe('intro/blocks.3');
    expect(slideStateKey('chart', [])).toBe('chart/component');
    const host = createMemoryStateHost();
    host.write('a/blocks.0', { picked: 'x' });
    expect(host.read('a/blocks.0')).toEqual({ picked: 'x' });
    expect(host.size).toBe(1);
    host.clear();
    expect(host.read('a/blocks.0')).toBeUndefined();
  });

  it('gates mutations: sortable and board read-only, workflow view-only, unless granted', () => {
    const sortable = { label: 'L', reorder: { bind: { $state: 'p' }, axis: 'vertical' } };
    expect(gatedProps('sortable-list', sortable, {}).reorder).toEqual(sortable.reorder);
    expect(gatedProps('sortable-list', sortable, { reorder: false }).reorder).toMatchObject({
      disabled: true,
    });
    expect(
      gatedProps('data-board', { label: 'B', bind: { items: { $state: 'i' } } }, { reorder: false })
        .bind
    ).toBeUndefined();
    const workflow = { ...WORKFLOW, mode: 'edit', bind: { graph: { $state: 'g' } } };
    expect(gatedProps('workflow-graph', workflow, {})).toMatchObject({ mode: 'view' });
    expect(gatedProps('workflow-graph', workflow, {}).bind).toBeUndefined();
    expect(gatedProps('workflow-graph', workflow, { workflowEdit: true }).mode).toBe('edit');
  });

  it('declares state the node reads, controls need and the author adds; wraps lone form nodes', () => {
    const sortable = componentBlueprint({
      id: 'sortable-list',
      props: { label: 'L', reorder: { bind: { $state: 'p' } } },
    });
    expect(sortable.state).toEqual({ p: { type: 'list', initial: [] } });
    const slider = componentBlueprint({ id: 'control-slider', props: { state: 'n', label: 'N' } });
    expect(slider.state).toEqual({ n: { type: 'number', min: 0, max: 100 } });
    const declared = componentBlueprint({
      id: 'sortable-list',
      props: {
        label: 'L',
        reorder: { bind: { $state: 'p' } },
        $declare: { p: { type: 'list', initial: [{ id: 'a', label: 'A' }] } },
      },
    });
    expect(declared.state).toEqual({ p: { type: 'list', initial: [{ id: 'a', label: 'A' }] } });
    const tree = (blueprint: Bag) => (blueprint.tree as Bag).children as Bag[];
    expect(((tree(declared)[0] as Bag).props as Bag).$declare).toBeUndefined();
    const field = componentBlueprint({
      id: 'form-field',
      props: { name: 'e', state: 'e', label: 'Email' },
    });
    expect(tree(field)[0]).toMatchObject({ id: 'action-form', children: [{ id: 'form-field' }] });
  });

  it('copies only own, safe $declare keys: never __proto__, constructor or prototype', () => {
    // JSON.parse makes "__proto__" an own key; Object.assign would set the prototype.
    const props = JSON.parse(
      '{"label":"L","state":"__proto__","reorder":{"bind":{"$state":"constructor"}},' +
        '"$declare":{"__proto__":{"polluted":true},"constructor":{"type":"string"},' +
        '"prototype":{"type":"string"},"p":{"type":"list","initial":[]}}}'
    ) as Bag;
    for (const id of ['sortable-list', 'control-toggle']) {
      const state = componentState(id, props);
      expect(Object.getPrototypeOf(state), id).toBe(Object.prototype);
      expect(Object.keys(state), id).toEqual(['p']);
      expect((state as { polluted?: unknown }).polluted, id).toBeUndefined();
      expect(({} as { polluted?: unknown }).polluted, id).toBeUndefined();
      const blueprint = componentBlueprint({ id, props });
      expect(JSON.stringify(blueprint.state), id).toBe('{"p":{"type":"list","initial":[]}}');
    }
  });

  it('control-choice infers its enum from options; $declare still overrides', async () => {
    const inferred = componentBlueprint({
      id: 'control-choice',
      props: {
        state: 'week',
        label: 'Week',
        options: ['this-week', { value: 'last-week' }, 'this-week', '', 4],
      },
    });
    expect(inferred.state).toEqual({
      week: { type: 'enum', values: ['this-week', 'last-week'], initial: 'this-week' },
    });
    const node = ((inferred.tree as Bag).children as Bag[])[0] as Bag;
    expect(node.props).toEqual({ state: 'week', label: 'Week' });
    const declared = componentBlueprint({
      id: 'control-choice',
      props: {
        state: 'week',
        label: 'Week',
        options: ['a', 'b'],
        $declare: { week: { type: 'enum', values: ['x', 'y'] } },
      },
    });
    expect(declared.state).toEqual({ week: { type: 'enum', values: ['x', 'y'] } });
    expect(
      componentBlueprint({ id: 'control-choice', props: { state: 'week', label: 'Week' } }).state
    ).toBeUndefined();
    expect(
      validateSlideComponent(
        {
          component: 'control-choice',
          props: { state: 'week', label: 'Week', options: ['a', 'b'] },
        },
        []
      )
    ).toEqual([]);

    mockPreferences();
    const deck = {
      formatVersion: 2,
      meta: { title: 'T' },
      slides: [
        {
          id: 'choice',
          layout: 'free',
          blocks: [
            {
              type: 'component',
              component: 'control-choice',
              props: { state: 'week', label: 'Week', options: ['this-week', 'last-week'] },
            },
          ],
        },
      ],
    };
    const { container } = render(DeckStage, { props: { deck, loadTheme: null } });
    await waitFor(
      () => {
        expect(container.textContent).toContain('last-week');
        expect(container.querySelector('.tx-player__notice')).toBeNull();
      },
      { timeout: 15_000 }
    );
  });

  it('keeps a component’s state in the host across remounts', async () => {
    mockPreferences();
    const host = createMemoryStateHost();
    const renderers = createComponentRenderers({ stateHost: host });
    const deck = {
      formatVersion: 2,
      meta: { title: 'T' },
      slides: [
        {
          id: 'toggle',
          layout: 'free',
          blocks: [
            {
              type: 'component',
              component: 'control-toggle',
              props: { state: 'on', label: 'Dark mode' },
            },
          ],
        },
      ],
    };
    const { container } = render(DeckStage, { props: { deck, loadTheme: null, renderers } });
    const input = await waitFor(() => {
      const found = container.querySelector<HTMLInputElement>(
        '[data-tx-deck-component] input, [data-tx-deck-component] button[role="switch"], [data-tx-deck-component] [role="switch"]'
      );
      expect(found).toBeTruthy();
      return found as HTMLElement;
    });
    await fireEvent.click(input);
    await waitFor(() => expect(host.read('toggle/blocks.0')).toMatchObject({ on: true }));
  });
});

describe('registry: free-slide extensions', () => {
  it('paints $$ math as MathML elements from the allowlist, never markup', () => {
    const { container } = render(MathBlock, { props: { tex: '\\frac{a}{b} + \\sqrt{2}' } });
    const math = container.querySelector('math');
    expect(math?.namespaceURI).toBe('http://www.w3.org/1998/Math/MathML');
    expect(math?.getAttribute('display')).toBe('block');
    expect(math?.getAttribute('alttext')).toBe('\\frac{a}{b} + \\sqrt{2}');
    expect(container.querySelector('mfrac')?.namespaceURI).toBe(
      'http://www.w3.org/1998/Math/MathML'
    );
    expect(container.querySelector('msqrt mn')?.textContent).toBe('2');
  });

  it('shows refused TeX as source text, never as markup', () => {
    const tex = '\\href{javascript:alert(1)}{<img src=x onerror=alert(1)>}';
    const { container } = render(MathBlock, { props: { tex } });
    expect(container.querySelector('math')).toBeNull();
    expect(container.querySelector('code')?.textContent).toBe(tex);
    expect(container.querySelector('img, a, script')).toBeNull();
    expect(container.querySelector('[role="note"]')?.textContent).toMatch(/refused/);
  });

  it('paints math, measured images and family blocks on a free slide with steps', async () => {
    const { container } = renderFree([
      { type: 'math', tex: 'e^{i\\pi} + 1 = 0', step: 1 },
      { type: 'image', src: 'images/pixel.png', alt: 'One pixel', step: 2 },
      { type: 'terminal', lines: [{ kind: 'prompt', text: 'pnpm test' }], step: 3 },
      { type: 'text', markdown: 'Plain **text** still paints.' },
    ]);
    const items = () => [...container.querySelectorAll<HTMLElement>('[data-tx-deck-item]')];
    expect(items().map((item) => item.dataset.txDeckFragment)).toEqual([
      'hidden',
      'hidden',
      'hidden',
      undefined,
    ]);
    expect(container.querySelector('math mi')?.textContent).toBe('e');
    const image = container.querySelector<HTMLImageElement>('[data-tx-deck-measured] img');
    expect(image?.getAttribute('src')).toBe('images/pixel.png');
    expect(image?.getAttribute('alt')).toBe('One pixel');
    expect(image?.hasAttribute('width')).toBe(false);
    Object.defineProperty(image, 'naturalWidth', { value: 640 });
    Object.defineProperty(image, 'naturalHeight', { value: 480 });
    await fireEvent.load(image as HTMLImageElement);
    expect(image?.getAttribute('width')).toBe('640');
    expect(image?.getAttribute('height')).toBe('480');
    expect(
      container.querySelector('[data-tx-deck-measured]')?.getAttribute('data-tx-deck-measured')
    ).toBe('natural');
    await waitFor(
      () =>
        expect(
          container.querySelector('[data-tx-deck-component="blocks-diagram"] [data-tx-player]')
        ).toBeTruthy(),
      { timeout: 15_000 }
    );
    await waitFor(() => expect(container.textContent).toContain('pnpm test'), { timeout: 15_000 });
    await waitFor(() => expect(container.textContent).toContain('Plain text still paints.'));
  });

  it('refuses unsafe image sources: at the tier, or by the block schema', () => {
    // A data: image is a valid block, but the untrusted URL policy refuses it at paint.
    const tiered = renderFree([{ type: 'image', src: PNG, alt: 'Inline pixel' }]);
    expect(tiered.container.querySelector('img')).toBeNull();
    expect(tiered.container.querySelector('.tx-deck-stage__media-refused')).toBeTruthy();
    tiered.unmount();
    // The developer tier allows it.
    const developer = renderFree([{ type: 'image', src: PNG, alt: 'Inline pixel' }], {
      tier: 'developer',
    });
    expect(developer.container.querySelector('img')?.getAttribute('src')).toBe(PNG);
    developer.unmount();
    // A remote http: image is not a valid block at all: nothing paints from it.
    const remote = renderFree([
      { type: 'image', src: 'http://example.com/a.png', alt: 'Plain http' },
    ]);
    expect(remote.container.querySelector('img')).toBeNull();
    expect(remote.container.querySelector('[role="note"]')).toBeTruthy();
  });

  it('validateSlideBlock accepts math, unsized images and family blocks, refuses the rest', () => {
    expect(
      validateSlideBlock({ type: 'math', tex: '\\frac{1}{2}' }, ['slides', 0, 'blocks', 0])
    ).toEqual([]);
    expect(validateSlideBlock({ type: 'math', tex: '\\href{x}{y}' }, [])[0]?.message).toMatch(
      /tex-unsupported/
    );
    expect(validateSlideBlock({ type: 'math', tex: '' }, [])).toHaveLength(1);
    expect(validateSlideBlock({ type: 'math', tex: 'x', html: '<b>' }, [])).toHaveLength(1);
    expect(validateSlideBlock({ type: 'image', src: 'images/a.png', alt: 'A' }, [])).toEqual([]);
    expect(
      validateSlideBlock({ type: 'image', src: 'javascript:alert(1)', alt: 'A' }, []).length
    ).toBeGreaterThan(0);
    expect(validateSlideBlock({ type: 'image', src: 'images/a.png' }, []).length).toBeGreaterThan(
      0
    );
    expect(
      validateSlideBlock({ type: 'terminal', lines: [{ kind: 'prompt', text: 'ls' }] }, [])
    ).toEqual([]);
    expect(validateSlideBlock({ type: 'map', points: 'nope' }, []).length).toBeGreaterThan(0);
    expect(validateSlideBlock({ type: 'text', markdown: 'ok' }, [])).toEqual([]);
    expect(validateSlideBlock({ type: 'nope' }, []).length).toBeGreaterThan(0);
    expect(extendedItem({ type: 'text', markdown: 'x' })).toBeUndefined();
    expect(
      extendedItem({ type: 'image', src: 'a.png', alt: 'A', width: 10, height: 10 })
    ).toBeUndefined();
  });
});

describe('registry: components beyond the model’s depth-4 props cap', () => {
  // `@texuli/deck` caps component props at depth 4 (`boundedProps`), so a
  // workflow graph cannot pass `parseDeck` yet (open issue for the model).
  // The registry still paints it, with steps, on its free-slide path.
  it('paints workflow-graph with steps', async () => {
    const { container } = renderFree(
      [
        {
          type: 'component',
          component: 'workflow-graph',
          props: WORKFLOW,
          step: 1,
          fragment: 'grow',
        },
      ],
      { step: 1 }
    );
    const item = container.querySelector<HTMLElement>('[data-tx-deck-item="0"]');
    expect(item?.dataset.txDeckFragment).not.toBe('hidden');
    expect(item?.dataset.txDeckEffect).toBe('grow');
    await waitFor(
      () =>
        expect(
          container.querySelector('[data-tx-deck-component="workflow-graph"] [data-tx-player]')
        ).toBeTruthy(),
      { timeout: 15_000 }
    );
    await waitFor(() => expect(container.querySelector('[data-tx-player-skeleton]')).toBeNull(), {
      timeout: 15_000,
    });
    const player = container.querySelector<HTMLElement>('[data-tx-player]');
    expect(player?.dataset.status).not.toBe('invalid');
    expect(container.textContent).toContain('Request');
    expect(validateSlideComponent({ component: 'workflow-graph', props: WORKFLOW }, [])).toEqual(
      []
    );
  });
});

describe('registry: hostile props are refused safely', () => {
  const sinkFree = (container: HTMLElement) => {
    expect(container.querySelector('script, iframe, object, embed')).toBeNull();
    expect(container.innerHTML).not.toMatch(/javascript:/i);
    expect(container.innerHTML).not.toMatch(/\son(error|load|click)=/i);
  };

  it.each([
    ['media-image', { src: 'javascript:alert(1)', alt: 'x' }],
    ['media-image', { src: 'https://example.com/a.png', alt: 'x', onload: 'alert(1)' }],
    [
      'blocks-text',
      { block: { type: 'text', markdown: '<script>alert(1)</script> [x](javascript:alert(1))' } },
    ],
    ['blocks-embed', { block: { type: 'link-preview', href: 'javascript:alert(1)', title: 'x' } }],
    [
      'blocks-media',
      { block: { type: 'image', src: 'data:text/html,<script>', alt: 'x', width: 1, height: 1 } },
    ],
    [
      'blocks-diagram',
      {
        block: {
          type: 'flow',
          nodes: Array.from({ length: 5_000 }, (_, i) => ({ id: `n${i}`, label: 'x' })),
        },
      },
    ],
    [
      'blocks-map',
      { block: { type: 'map', title: 'x', tiles: 'https://evil.example/{z}/{x}/{y}.png' } },
    ],
    ['blocks-code', { block: { type: 'code', code: '</code><img src=x onerror=alert(1)>' } }],
    [
      'blocks-data',
      {
        block: {
          type: 'table',
          columns: [{ id: 'a', label: '<b>x</b>' }],
          rows: [{ a: '<img src=x onerror=1>' }],
        },
      },
    ],
    [
      'blocks-structure',
      { block: { type: 'cta', actions: [{ label: 'Go', href: 'javascript:alert(1)' }] } },
    ],
    [
      'blocks-interactive',
      { block: { type: 'poll', question: '<svg onload=alert(1)>', options: [] } },
    ],
    [
      'charts-bar',
      { title: 'x', data: Array.from({ length: 20_000 }, (_, i) => ({ label: `${i}`, value: i })) },
    ],
    [
      'data-grid',
      {
        label: 'x',
        columns: [{ id: 'a', header: '<img src=x onerror=1>' }],
        rows: [{ id: 'r', cells: { a: 'javascript:alert(1)' } }],
      },
    ],
    [
      'chat-thread',
      { label: 'x', messages: [{ id: 'm', role: 'user', text: '<script>alert(1)</script>' }] },
    ],
    ['sortable-list', { label: 'x', reorder: { bind: { $state: '__proto__' } } }],
    [
      'workflow-graph',
      {
        label: 'x',
        graph: { version: 1, nodes: [{ id: 'a', label: '<img src=x onerror=1>' }], constructor: 1 },
      },
    ],
    ['control-toggle', { state: 'constructor', label: '<b>x</b>' }],
    ['form-field', { name: 'x', state: 'x', label: 'x', kind: 'javascript' }],
  ])('%s', async (id, props) => {
    validateSlideComponent({ component: id, props }, ['slides', 0, 'blocks', 0]);
    const { container } = renderFree([{ type: 'component', component: id, props }]);
    await waitFor(
      () =>
        expect(
          container.querySelector('[data-tx-player], [data-tx-deck-component-refused]')
        ).toBeTruthy(),
      { timeout: 15_000 }
    );
    await waitFor(() => expect(container.querySelector('[data-tx-player-skeleton]')).toBeNull(), {
      timeout: 15_000,
    });
    sinkFree(container);
  });

  it('refuses hostile props at parse time with component-props issues', () => {
    for (const [id, props] of [
      ['media-image', { src: 'javascript:alert(1)', alt: 'x' }],
      ['charts-bar', { title: 'x', data: 'not-an-array' }],
      ['blocks-text', { block: { type: 'video', src: 'x' } }],
    ] as const) {
      const issues = validateSlideComponent({ component: id, props: props as Bag }, [
        'slides',
        0,
        'blocks',
        0,
      ]);
      expect(issues.length, id).toBeGreaterThan(0);
      expect(
        issues.every((issue) => issue.code === 'component-props'),
        id
      ).toBe(true);
    }
  });
});
