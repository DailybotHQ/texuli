// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  checkCompositionGrammar,
  DECK_GRAMMAR_IDS,
  defaultGrammarRoles,
  type GrammarComponentMeta,
  grammarIssueSeverity,
  grammarRolesFromList,
} from '../src/render/grammar/index.ts';
import type { RenderNode } from '../src/render/renderer/types.ts';

function component(
  id: string,
  props: Record<string, unknown> = {},
  children: RenderNode[] = []
): RenderNode {
  return {
    kind: 'component',
    id,
    props,
    children,
  };
}

const roles = defaultGrammarRoles;

describe('heading outline', () => {
  it('heading outline: monotonic levels, one h1, and clamping repairs', () => {
    // accepts a monotonic outline and rejects skips and multiple h1
    {
      const ok = checkCompositionGrammar(
        [
          component('heading', { level: 1 }),
          component('heading', { level: 2 }),
          component('heading', { level: 3 }),
        ],
        { roles }
      );
      expect(ok.ok).toBe(true);
      expect(ok.issues).toEqual([]);

      const skip = checkCompositionGrammar(
        [component('heading', { level: 1 }), component('heading', { level: 3 })],
        { roles }
      );
      expect(skip.ok).toBe(false);
      expect(skip.issues.some((i) => i.code === 'heading-skip')).toBe(true);

      const multi = checkCompositionGrammar(
        [component('heading', { level: 1 }), component('heading', { level: 1 })],
        { roles }
      );
      expect(multi.issues.some((i) => i.code === 'heading-multiple-h1')).toBe(true);
    }
    // repairs skipped levels by clamping
    {
      const { roots, issues } = checkCompositionGrammar(
        [component('heading', { level: 1 }), component('heading', { level: 4 })],
        { roles, mode: 'repair' }
      );
      expect(issues.some((i) => i.code === 'heading-skip')).toBe(true);
      const second = roots[1];
      expect(second?.kind).toBe('component');
      if (second?.kind === 'component') {
        expect(second.props.level).toBe(2);
      }
    }
  });
});

describe('interactive nesting', () => {
  it('flags a button inside a button and repairs to a placeholder', () => {
    const tree = [
      component('button', { variant: 'secondary' }, [
        component('button', { variant: 'secondary' }),
      ]),
    ];
    const reported = checkCompositionGrammar(tree, { roles });
    expect(reported.ok).toBe(false);
    expect(reported.issues.some((i) => i.code === 'interactive-nesting')).toBe(true);
    expect(reported.roots[0]).toEqual(tree[0]);

    const repaired = checkCompositionGrammar(tree, { roles, mode: 'repair' });
    const outer = repaired.roots[0];
    expect(outer?.kind).toBe('component');
    if (outer?.kind === 'component') {
      expect(outer.children[0]?.kind).toBe('placeholder');
    }
  });
});

describe('primary action per container', () => {
  it('allows one default button in a card and flags a second', () => {
    const ok = checkCompositionGrammar(
      [
        component('card', {}, [
          component('button', { variant: 'default' }),
          component('button', { variant: 'secondary' }),
        ]),
      ],
      { roles }
    );
    expect(ok.ok).toBe(true);

    const bad = checkCompositionGrammar(
      [
        component('card', {}, [
          component('button', { variant: 'default' }),
          component('button', { variant: 'primary' }),
        ]),
      ],
      { roles }
    );
    expect(bad.issues.some((i) => i.code === 'primary-action-multiple')).toBe(true);

    const repaired = checkCompositionGrammar(
      [
        component('card', {}, [
          component('button', { variant: 'default' }),
          component('button', { variant: 'primary' }),
        ]),
      ],
      { roles, mode: 'repair' }
    );
    const card = repaired.roots[0];
    expect(card?.kind).toBe('component');
    if (card?.kind === 'component') {
      const second = card.children[1];
      expect(second?.kind).toBe('component');
      if (second?.kind === 'component') {
        expect(second.props.variant).toBe('secondary');
      }
    }
  });
});

describe('landmarks', () => {
  it('allows one main and warns on duplicate navigation', () => {
    const multiMain = checkCompositionGrammar([component('main'), component('main')], { roles });
    expect(multiMain.ok).toBe(false);
    expect(multiMain.issues.some((i) => i.code === 'landmark-multiple-main')).toBe(true);

    const dupNav = checkCompositionGrammar([component('nav'), component('navigation')], { roles });
    expect(dupNav.issues.some((i) => i.code === 'landmark-duplicate')).toBe(true);
    expect(grammarIssueSeverity('landmark-duplicate')).toBe('warning');
    expect(dupNav.ok).toBe(true);
  });
});

describe('visual order', () => {
  it('flags and strips order-breaking props', () => {
    const custom: GrammarComponentMeta[] = [
      {
        id: 'layer',
        role: 'static',
        orderBreakingProps: ['position', 'order'],
      },
    ];
    const catalog = grammarRolesFromList(custom);
    const tree = [component('layer', { position: 'absolute', order: 2 })];
    const reported = checkCompositionGrammar(tree, { roles: catalog });
    expect(reported.issues.filter((i) => i.code === 'visual-order').length).toBe(2);

    const repaired = checkCompositionGrammar(tree, { roles: catalog, mode: 'repair' });
    const node = repaired.roots[0];
    expect(node?.kind).toBe('component');
    if (node?.kind === 'component') {
      expect(node.props.position).toBeUndefined();
      expect(node.props.order).toBeUndefined();
    }
  });
});

describe('DOM order equals visual order (children sequence)', () => {
  it('preserves child array order as the composition order', () => {
    const tree = [
      component('stack', {}, [
        component('heading', { level: 2, title: 'A' }),
        component('heading', { level: 2, title: 'B' }),
      ]),
    ];
    const { roots } = checkCompositionGrammar(tree, { roles, mode: 'repair' });
    const stack = roots[0];
    expect(stack?.kind).toBe('component');
    if (stack?.kind === 'component') {
      expect(stack.children.map((c) => (c.kind === 'component' ? c.props.title : ''))).toEqual([
        'A',
        'B',
      ]);
    }
  });
});

describe('catalog ids in the default roles (G15)', () => {
  const text = (block: Record<string, unknown>) => component('blocks-text', { block });
  const heading = (level: number, value: string) => text({ type: 'heading', level, text: value });
  const codes = (tree: RenderNode[]) =>
    checkCompositionGrammar(tree, { roles }).issues.map((issue) => `${issue.path} ${issue.code}`);

  it('G15: catalog ids get heading ranks, the main landmark and in-block repairs', () => {
    // reports two h1 text blocks and a skip under a titled doc
    {
      const tree = [
        component('layout-doc', { title: 'Report' }, [
          heading(1, 'A'),
          heading(1, 'B'),
          heading(4, 'C'),
        ]),
      ];
      const result = checkCompositionGrammar(tree, { roles });
      expect(result.ok).toBe(false);
      expect(codes(tree)).toEqual([
        '0.children.0 heading-multiple-h1',
        '0.children.1 heading-multiple-h1',
        '0.children.2 heading-skip',
      ]);
    }
    // accepts a doc title, h2 text blocks and titled cards one rank below their frame
    {
      const tree = [
        component('layout-page', { title: 'Week 42' }, [
          heading(2, 'Highlights'),
          text({ type: 'text', markdown: 'Shipped on time.' }),
          component('layout-grid', { columns: 2 }, [
            component('layout-card', { title: 'Tickets' }, [
              component('charts-line', { title: 'Tickets per day' }),
            ]),
            component('layout-card', { title: 'Channels' }, [heading(3, 'Email')]),
          ]),
        ]),
      ];
      expect(codes(tree)).toEqual([]);
    }
    // ranks a nested card below its titled card and sees chart title ranks
    {
      const skipped = [
        component('layout-page', { title: 'Overview' }, [
          component('charts-donut', { title: 'Channel mix' }),
        ]),
      ];
      expect(codes(skipped)).toEqual(['0.children.0 heading-skip']);

      const nested = [
        component('layout-doc', { title: 'Guide' }, [
          component('layout-card', { title: 'Setup' }, [
            component('layout-card', { title: 'Accounts' }, [heading(5, 'Too deep')]),
          ]),
        ]),
      ];
      expect(codes(nested)).toEqual(['0.children.0.children.0.children.0 heading-skip']);
    }
    // treats untitled frames and non-heading text blocks as no heading
    {
      const tree = [
        component('layout-doc', {}, [
          text({ type: 'callout', tone: 'info', text: 'Draft' }),
          heading(1, 'Only title'),
          heading(2, 'Section'),
        ]),
      ];
      expect(codes(tree)).toEqual([]);
    }
    // marks page, doc and deck as the main landmark
    {
      const tree = [component('layout-page', {}, [component('layout-doc', {})])];
      expect(codes(tree)).toEqual(['0.children.0 landmark-multiple-main']);
    }
    // repairs a text block heading level inside its block
    {
      const first = heading(1, 'A');
      const tree = [component('layout-doc', { title: 'Report' }, [first, heading(4, 'B')])];
      const repaired = checkCompositionGrammar(tree, { roles, mode: 'repair' });
      const doc = repaired.roots[0];
      const levels =
        doc?.kind === 'component'
          ? doc.children.map((child) =>
              child.kind === 'component' ? (child.props.block as { level: number }).level : null
            )
          : [];
      expect(levels).toEqual([2, 3]);
      expect(first).toEqual(heading(1, 'A'));
    }
  });
});

describe('nested and derived roles (G15 v2)', () => {
  it('G15 v2: nested and derived roles fall back safely', () => {
    // treats a heading inside an interactive control as static text
    {
      const tree = component('layout-page', { title: 'Report' }, [
        component('button', {}, [component('heading', { level: 1 }, [])]),
      ]);
      const result = checkCompositionGrammar([tree], { roles, mode: 'report' });
      // The label heading must not count as a second level-1 heading.
      expect(result.issues.map((issue) => issue.code)).not.toContain('heading-multiple-h1');
      expect(result.ok).toBe(true);
    }
    // derives a host role from a built-in id
    {
      const derived = grammarRolesFromList(
        [{ id: 'my-alert', deriveFrom: 'heading' }],
        defaultGrammarRoles
      );
      const tree = component('layout-page', { title: 'Report' }, [
        component('my-alert', { level: 3 }, []),
      ]);
      const result = checkCompositionGrammar([tree], { roles: derived });
      expect(result.issues.map((issue) => issue.code)).toContain('heading-skip');
      // With the plain defaults the unknown id stays static: no skip is seen.
      const plain = checkCompositionGrammar([tree], { roles });
      expect(plain.issues.map((issue) => issue.code)).not.toContain('heading-skip');
    }
    // falls back safely on derivation cycles and missing bases
    {
      const catalog = grammarRolesFromList([
        { id: 'a', deriveFrom: 'b' },
        { id: 'b', deriveFrom: 'a', landmark: 'search' },
        { id: 'c', deriveFrom: 'missing' },
      ]);
      expect(catalog.get('a')?.role).toBe('static');
      expect(catalog.get('b')?.landmark).toBe('search');
      expect(catalog.get('c')?.role).toBe('static');
    }
    expect(defaultGrammarRoles.get('blocks-heading')?.role).toBe('heading');
    expect(defaultGrammarRoles.get('blocks-heading')?.headingLevelProp).toBe('level');
    expect(defaultGrammarRoles.get('text-heading')?.role).toBe('heading');
  });
});

describe('deck grammar (G11)', () => {
  const text = (block: Record<string, unknown>) => component('blocks-text', { block });
  const heading = (level: number, value: string) => text({ type: 'heading', level, text: value });
  const slide = (title: string | undefined, children: RenderNode[] = [], notes?: string) =>
    component(
      DECK_GRAMMAR_IDS.slide,
      { slideId: 'one', ...(title ? { title } : {}), ...(notes ? { notes } : {}) },
      children
    );
  const issues = (tree: RenderNode[]) =>
    checkCompositionGrammar(tree, { roles }).issues.map((issue) => `${issue.path} ${issue.code}`);

  it('deck grammar ranks slides under the deck title with one main landmark', () => {
    expect(DECK_GRAMMAR_IDS).toEqual({
      deck: 'layout-deck',
      slide: 'deck-slide',
      controls: 'deck-controls',
      overview: 'deck-overview',
      notes: 'deck-notes',
      upNext: 'deck-up-next',
    });
    expect(Object.isFrozen(DECK_GRAMMAR_IDS)).toBe(true);
    // ranks each slide title one below the deck title, and slide headings below it
    {
      const deck = [
        component(DECK_GRAMMAR_IDS.deck, { title: 'Quarterly review' }, [
          slide('Opening', [heading(3, 'Three priorities')]),
          slide('Numbers', [component('charts-line', { title: 'Revenue' })]),
          slide(undefined, [heading(2, 'Untitled slide heading')]),
        ]),
      ];
      expect(issues(deck)).toEqual([]);

      const skipped = [
        component(DECK_GRAMMAR_IDS.deck, { title: 'Quarterly review' }, [
          slide('Opening', [heading(4, 'Too deep')]),
        ]),
      ];
      expect(issues(skipped)).toEqual(['0.children.0.children.0 heading-skip']);
    }
    expect(roles.get(DECK_GRAMMAR_IDS.slide)).toMatchObject({
      role: 'container',
      titleHeading: 'nested',
    });
    expect(roles.get(DECK_GRAMMAR_IDS.slide)?.deriveFrom).toBeUndefined();
    // treats presenter notes as a landmark only outside slides
    {
      const presenting = [
        component(DECK_GRAMMAR_IDS.deck, { title: 'Pitch' }, [
          component(DECK_GRAMMAR_IDS.controls, {}, [component('button', { variant: 'ghost' })]),
          component(DECK_GRAMMAR_IDS.overview),
          slide('Opening'),
          component(DECK_GRAMMAR_IDS.notes),
          component(DECK_GRAMMAR_IDS.upNext),
        ]),
      ];
      expect(issues(presenting)).toEqual([]);

      const twoNotesSurfaces = [
        component(DECK_GRAMMAR_IDS.deck, {}, [
          component(DECK_GRAMMAR_IDS.notes),
          component(DECK_GRAMMAR_IDS.notes),
        ]),
      ];
      expect(issues(twoNotesSurfaces)).toEqual(['0.children.1 landmark-duplicate']);

      const notesInSlides = [
        component(DECK_GRAMMAR_IDS.deck, { title: 'Pitch' }, [
          slide('One', [component(DECK_GRAMMAR_IDS.notes)]),
          slide('Two', [component(DECK_GRAMMAR_IDS.notes)]),
        ]),
      ];
      expect(issues(notesInSlides)).toEqual([]);
    }
    // needs a deck title so slide titles are not each an h1
    {
      const untitled = [component(DECK_GRAMMAR_IDS.deck, {}, [slide('One'), slide('Two')])];
      expect(issues(untitled)).toEqual(['0.children.1 heading-multiple-h1']);
    }
    // keeps one main landmark per deck
    {
      const nested = [component(DECK_GRAMMAR_IDS.deck, {}, [component(DECK_GRAMMAR_IDS.deck)])];
      expect(issues(nested)).toEqual(['0.children.0 landmark-multiple-main']);
    }
  });
});
