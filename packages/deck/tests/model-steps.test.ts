// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { parseDeck } from '../src/model/parse.ts';
import { FRAGMENT_EFFECTS, type FragmentEffect, MAX_SLIDE_STEPS } from '../src/model/shared.ts';
import {
  activeCodeHighlight,
  type FragmentPhase,
  fragmentPhase,
  isPhaseShown,
  REVEAL_EFFECT,
  type SlideSteps,
  slideFragments,
  slideStepCount,
  slideSteps,
  steppablePattern,
} from '../src/model/steps/index.ts';

/** Per step: `[authored, effect, jsonPath]` of each fragment. */
const table = (steps: SlideSteps) =>
  steps.steps.map((s) => s.fragments.map((f) => [f.authored, f.effect, f.jsonPath]));
const codes = (steps: SlideSteps) =>
  steps.issues.map((i) => `${i.severity} ${i.code} ${i.jsonPath}`);

describe('slideSteps: renumbering', () => {
  it('renumbers distinct authored steps densely (2, 5, 7 → 1, 2, 3), keeping step 0 initial', () => {
    const steps = slideSteps({
      id: 'launch',
      layout: 'free',
      blocks: [
        { type: 'heading', text: 'Launch plan' },
        { type: 'text', markdown: 'Third', step: 7, reveal: 'fade-up' },
        { type: 'text', markdown: 'First', step: 2 },
        { type: 'callout', body: 'Also first', step: 2, fragment: 'highlight', tone: 'danger' },
        { type: 'quote', quote: 'Second', step: 5, reveal: 'strike' },
        { type: 'text', markdown: 'Always', step: 0, reveal: 'grow' },
      ],
    });
    expect(steps.count).toBe(3);
    expect(steps.initial).toBe(0);
    expect(steps.steps.map((s) => s.index)).toEqual([0, 1, 2, 3]);
    expect(table(steps)).toEqual([
      [[0, 'grow', '$.blocks[5]']],
      [
        [2, 'in', '$.blocks[2]'],
        [2, 'highlight', '$.blocks[3]'],
      ],
      [[5, 'strike', '$.blocks[4]']],
      [[7, 'fade-up', '$.blocks[1]']],
    ]);
    expect(steps.steps[1]?.fragments[1]?.tone).toBe('danger');
    for (const step of steps.steps) for (const f of step.fragments) expect(f.step).toBe(step.index);
    expect(steps.issues).toEqual([]);
    expect(slideStepCount({ blocks: [{ type: 'text', step: 9 }] })).toBe(1);
  });

  it('is deterministic for any authored order and has no steps when nothing steps', () => {
    const blocks = [3, 1, 2, 1, 900].map((step, i) => ({ type: 'text', id: `b${i}`, step }));
    const once = slideSteps({ blocks });
    expect(slideSteps({ blocks: [...blocks].reverse() }).count).toBe(once.count);
    expect(once.steps.map((s) => s.fragments.map((f) => f.blockId))).toEqual([
      [],
      ['b1', 'b3'],
      ['b2'],
      ['b0'],
      ['b4'],
    ]);
    expect(slideSteps({ blocks: [{ type: 'text' }] })).toEqual({
      count: 0,
      initial: 0,
      steps: [{ index: 0, fragments: [] }],
      issues: [],
    });
  });

  it('ignores invalid steps and survives non-object input', () => {
    const steps = slideSteps({
      blocks: [
        { type: 'text', step: 1.5 },
        { type: 'text', step: -1 },
        { type: 'text', step: '2' },
        { type: 'text', step: 1001 },
        null,
        'text',
        { type: 'text', step: 4, fragment: 'explode' },
      ],
      props: { a: { step: 2.5 }, b: { step: 3 } },
    });
    expect(table(steps)).toEqual([[], [[3, 'in', '$.props.b']], [[4, 'in', '$.blocks[6]']]]);
    for (const bad of [null, undefined, 42, 'slide', []]) {
      expect(slideSteps(bad as never).count).toBe(0);
    }
  });
});

describe('slideSteps: every source kind', () => {
  it('steps nested blocks in document order (blocks, children, columns, tabs panels)', () => {
    const steps = slideSteps({
      blocks: [
        {
          type: 'columns',
          columns: [
            [{ type: 'text', id: 'left', step: 1 }],
            [{ type: 'text', id: 'right', step: 1 }],
          ],
        },
        { type: 'tabs', panels: [{ label: 'A', blocks: [{ type: 'text', id: 'tab', step: 1 }] }] },
        { type: 'group', blocks: [{ type: 'text', id: 'inner', step: 1 }] },
        { type: 'group', children: [{ type: 'text', id: 'child', step: 1 }] },
        { type: 'component', component: 'x', props: { step: 1, blocks: [{ step: 2 }] }, step: 1 },
      ],
    });
    expect(steps.count).toBe(1);
    expect(steps.steps[1]?.fragments.map((f) => f.jsonPath)).toEqual([
      '$.blocks[0].columns[0][0]',
      '$.blocks[0].columns[1][0]',
      '$.blocks[1].panels[0].blocks[0]',
      '$.blocks[2].blocks[0]',
      '$.blocks[3].children[0]',
      '$.blocks[4]',
    ]);
  });

  it('reveals list items one per step from the list step (v1 items kind)', () => {
    const steps = slideSteps({
      blocks: [
        { type: 'heading', step: 1 },
        { type: 'list', id: 'why', step: 2, reveal: 'fade-up', items: ['a', 'b', 'c'] },
        { type: 'list', items: ['static'] },
      ],
    });
    expect(steps.count).toBe(4);
    expect(
      steps.steps.map((s) => s.fragments.map((f) => [f.kind, f.item ?? null, f.effect]))
    ).toEqual([
      [],
      [['block', null, 'in']],
      [
        ['block', null, 'fade-up'],
        ['item', 0, 'fade-up'],
      ],
      [['item', 1, 'fade-up']],
      [['item', 2, 'fade-up']],
    ]);
    // A list at step 0 shows its first item initially, then one per step.
    const zero = slideSteps({ blocks: [{ type: 'list', step: 0, items: ['a', 'b'] }] });
    expect(zero.count).toBe(1);
    expect(zero.steps[0]?.fragments.map((f) => f.kind)).toEqual(['block', 'item']);
  });

  it('steps code highlights from the block step (default 0), in blocks and in props', () => {
    const steps = slideSteps({
      blocks: [
        { type: 'heading', step: 1 },
        { type: 'code', id: 'setup', code: 'a', step: 2, highlights: ['1-2', '4-6', '3'] },
        { type: 'code', id: 'plain', code: 'b', highlights: ['1', '2'] },
      ],
    });
    expect(steps.count).toBe(4);
    expect(
      steps.steps.map((s) => s.fragments.map((f) => (f.kind === 'highlight' ? f.lines : f.kind)))
    ).toEqual([['1'], ['block', '2'], ['block', '1-2'], ['4-6'], ['3']]);
    const all = slideFragments(steps);
    const owner = ['blocks', 1];
    expect([0, 1, 2, 3, 4, 99].map((n) => activeCodeHighlight(all, owner, n))).toEqual([
      null,
      null,
      '1-2',
      '4-6',
      '3',
      '3',
    ]);
    expect(activeCodeHighlight(all, ['blocks', 2], 0)).toBe('1');
    expect(activeCodeHighlight(all, ['blocks', 0], 9)).toBeNull();

    const props = slideSteps(
      {
        layout: 'code-with-callout',
        props: { code: { source: '{}', highlights: ['1', '2-3', '4'] } },
      },
      { steppablePaths: ['', 'code'] }
    );
    expect(props.count).toBe(2);
    expect(slideFragments(props).map((f) => [f.step, f.jsonPath])).toEqual([
      [0, '$.props.code.highlights[0]'],
      [1, '$.props.code.highlights[1]'],
      [2, '$.props.code.highlights[2]'],
    ]);
    expect(props.issues).toEqual([]);
  });

  it('reads props markers with every effect, legacy reveal and tone', () => {
    const steps = slideSteps(
      {
        id: 'cards',
        layout: 'three-column-cards',
        props: {
          step: 1,
          fragment: 'fade-up',
          cards: [
            { title: 'A', step: 2, fragment: 'in-then-out' },
            { title: 'B', step: 3, reveal: 'fade', tone: 'success' },
            { title: 'C', step: 3, fragment: 'out', tone: 'nope' },
          ],
        },
      },
      { steppablePaths: ['', 'cards.*'] }
    );
    expect(table(steps)).toEqual([
      [],
      [[1, 'fade-up', '$.props']],
      [[2, 'in-then-out', '$.props.cards[0]']],
      [
        [3, 'in', '$.props.cards[1]'],
        [3, 'out', '$.props.cards[2]'],
      ],
    ]);
    expect(slideFragments(steps).map((f) => f.tone ?? null)).toEqual([null, null, 'success', null]);
    expect(steps.issues).toEqual([]);
  });

  it('maps every legacy reveal onto its fragment effect', () => {
    expect(REVEAL_EFFECT).toEqual({
      fade: 'in',
      'fade-up': 'fade-up',
      grow: 'grow',
      highlight: 'highlight',
      strike: 'strike',
    });
    for (const [reveal, effect] of Object.entries(REVEAL_EFFECT)) {
      const block = slideSteps({ blocks: [{ type: 'text', step: 1, reveal }] });
      const prop = slideSteps({ props: { x: { step: 1, reveal } } });
      expect([block, prop].map((s) => s.steps[1]?.fragments[0]?.effect)).toEqual([effect, effect]);
    }
  });

  it('labels steps 1… from slide.steps; labels may extend the count; custom slides use labels only', () => {
    const labelled = slideSteps({
      layout: 'agenda',
      props: { items: [{ text: 'A', step: 1 }] },
      steps: ['Problem', 'Solution', 42, 'Ask'],
    });
    expect(labelled.count).toBe(4);
    expect(labelled.steps.map((s) => [s.index, s.label ?? null, s.fragments.length])).toEqual([
      [0, null, 0],
      [1, 'Problem', 1],
      [2, 'Solution', 0],
      [3, null, 0],
      [4, 'Ask', 0],
    ]);
    const custom = slideSteps(
      { layout: 'custom', props: { component: 'x', data: { step: 1 } }, steps: ['One', 'Two'] },
      { steppablePaths: [] }
    );
    expect(custom.count).toBe(2);
    expect(slideFragments(custom)).toEqual([]);
    expect(custom.issues).toEqual([]);
  });
});

describe('slideSteps: conflicts and limits', () => {
  it('reports fragment + reveal together as fragment-conflict (fragment wins), on blocks and props', () => {
    const steps = slideSteps(
      {
        id: 's1',
        blocks: [{ type: 'text', step: 1, fragment: 'out', reveal: 'fade' }],
        props: { card: { step: 2, fragment: 'grow', reveal: 'strike' } },
      },
      { path: ['slides', 3] }
    );
    expect(codes(steps)).toEqual([
      'error fragment-conflict $.slides[3].blocks[0].reveal',
      'error fragment-conflict $.slides[3].props.card.reveal',
    ]);
    expect(steps.issues[0]?.slideId).toBe('s1');
    expect(steps.issues[0]?.pointer).toBe('/slides/3/blocks/0/reveal');
    expect(slideFragments(steps).map((f) => f.effect)).toEqual(['out', 'grow']);
  });

  it(`errors past ${MAX_SLIDE_STEPS} distinct steps and plays the rest on the last step`, () => {
    const at = (n: number) =>
      slideSteps({
        blocks: Array.from({ length: n }, (_, i) => ({ type: 'text', step: (i + 1) * 10 })),
      });
    const limit = at(MAX_SLIDE_STEPS);
    expect(limit.count).toBe(MAX_SLIDE_STEPS);
    expect(limit.issues).toEqual([]);
    const over = at(MAX_SLIDE_STEPS + 3);
    expect(over.count).toBe(MAX_SLIDE_STEPS);
    expect(over.steps).toHaveLength(MAX_SLIDE_STEPS + 1);
    expect(over.steps.at(-1)?.fragments).toHaveLength(4);
    expect(codes(over)).toEqual([`error too-many-steps $.blocks[${MAX_SLIDE_STEPS}]`]);
    // List items count as distinct steps too.
    const items = slideSteps({
      blocks: [{ type: 'list', step: 1, items: Array.from({ length: 40 }, String) }],
    });
    expect(codes(items)).toEqual([`error too-many-steps $.blocks[0].items[${MAX_SLIDE_STEPS}]`]);
    // Labels never push the count past the limit.
    expect(slideSteps({ steps: Array.from({ length: 40 }, String) }).count).toBe(MAX_SLIDE_STEPS);
  });

  it('warns step-unrevealed for markers off the steppable paths, which still count', () => {
    const slide = {
      id: 'c',
      layout: 'chart',
      props: { spec: { series: [{ name: 'a', step: 1 }] }, step: 2 },
    };
    const steps = slideSteps(slide, { steppablePaths: ['', 'spec'] });
    expect(steps.count).toBe(2);
    expect(codes(steps)).toEqual(['warning step-unrevealed $.props.spec.series[0]']);
    expect(steps.issues[0]?.fix).toBe('Move the marker to a steppable path: (props), spec.');
    // Without a catalog the check is skipped; with no steppable paths everything warns.
    expect(slideSteps(slide).issues).toEqual([]);
    expect(codes(slideSteps(slide, { steppablePaths: [] }))).toEqual([
      'warning step-unrevealed $.props',
      'warning step-unrevealed $.props.spec.series[0]',
    ]);
    expect(steppablePattern([])).toBe('');
    expect(steppablePattern(['cards', 2, 'cta'])).toBe('cards.*.cta');
  });

  it('warns step-missing for a props marker with fragment or reveal but no step', () => {
    const slide = {
      id: 'cards',
      layout: 'three-column-cards',
      props: {
        cards: [
          { heading: 'A', body: 'One', fragment: 'fade-up' },
          { heading: 'B', body: 'Two', reveal: 'grow', tone: 'accent' },
          { heading: 'C', body: 'Three', fragment: 'in', step: 1 },
        ],
      },
    };
    const steps = slideSteps(slide, { steppablePaths: ['cards.*'], path: ['slides', 2] });
    expect(steps.count).toBe(1);
    expect(codes(steps)).toEqual([
      'warning step-missing $.slides[2].props.cards[0]',
      'warning step-missing $.slides[2].props.cards[1]',
    ]);
    expect(steps.issues[0]?.message).toContain('"fragment" but no "step"');
    expect(steps.issues[1]?.message).toContain('"reveal" but no "step"');
    expect(steps.issues[0]?.slideId).toBe('cards');
    // parseDeck reports it as a warning: the deck stays valid.
    const parsed = parseDeck({ formatVersion: 2, meta: { title: 'Steps' }, slides: [slide] });
    expect(parsed.ok).toBe(true);
    expect(
      parsed.issues.map((issue) => `${issue.severity} ${issue.code} ${issue.jsonPath}`)
    ).toEqual([
      'warning step-missing $.slides[0].props.cards[0]',
      'warning step-missing $.slides[0].props.cards[1]',
    ]);
    // A marker with a step, or a tone alone, is not reported.
    expect(slideSteps({ props: { tone: 'accent' } }).issues).toEqual([]);
  });
});

describe('fragmentPhase', () => {
  /** Phases at steps 0..4 for a fragment on step 2 (and on step 0). */
  const expected: Record<FragmentEffect, [FragmentPhase[], FragmentPhase[]]> = {
    in: [
      ['hidden', 'hidden', 'visible', 'visible', 'visible'],
      ['visible', 'visible', 'visible', 'visible', 'visible'],
    ],
    'fade-up': [
      ['hidden', 'hidden', 'visible', 'visible', 'visible'],
      ['visible', 'visible', 'visible', 'visible', 'visible'],
    ],
    out: [
      ['visible', 'visible', 'gone', 'gone', 'gone'],
      ['gone', 'gone', 'gone', 'gone', 'gone'],
    ],
    'in-then-out': [
      ['hidden', 'hidden', 'visible', 'gone', 'gone'],
      ['visible', 'gone', 'gone', 'gone', 'gone'],
    ],
    grow: [
      ['visible', 'visible', 'active', 'active', 'active'],
      ['active', 'active', 'active', 'active', 'active'],
    ],
    shrink: [
      ['visible', 'visible', 'active', 'active', 'active'],
      ['active', 'active', 'active', 'active', 'active'],
    ],
    highlight: [
      ['visible', 'visible', 'active', 'active', 'active'],
      ['active', 'active', 'active', 'active', 'active'],
    ],
    strike: [
      ['visible', 'visible', 'active', 'active', 'active'],
      ['active', 'active', 'active', 'active', 'active'],
    ],
  };

  it('covers every effect across steps, on a later step and on the initial state', () => {
    expect(Object.keys(expected).sort()).toEqual([...FRAGMENT_EFFECTS].sort());
    for (const effect of FRAGMENT_EFFECTS) {
      const [later, initial] = expected[effect];
      const steps = [0, 1, 2, 3, 4];
      expect(
        steps.map((n) => fragmentPhase({ step: 2, effect }, n)),
        effect
      ).toEqual(later);
      expect(
        steps.map((n) => fragmentPhase({ step: 0, effect }, n)),
        effect
      ).toEqual(initial);
      // Negative and non-finite steps are the initial state; fractions truncate.
      expect(fragmentPhase({ step: 2, effect }, -3)).toBe(later[0]);
      expect(fragmentPhase({ step: 2, effect }, Number.NaN)).toBe(later[0]);
      expect(fragmentPhase({ step: 2, effect }, 2.9)).toBe(later[2]);
    }
    expect(
      ['hidden', 'visible', 'active', 'gone'].map((p) => isPhaseShown(p as FragmentPhase))
    ).toEqual([false, true, true, false]);
  });

  it('drives a renumbered slide end to end', () => {
    const steps = slideSteps({
      blocks: [
        { type: 'text', id: 'a', step: 10, fragment: 'in-then-out' },
        { type: 'text', id: 'b', step: 20 },
      ],
    });
    const [a, b] = slideFragments(steps);
    expect(
      [0, 1, 2].map((n) => [fragmentPhase(a as never, n), fragmentPhase(b as never, n)])
    ).toEqual([
      ['hidden', 'hidden'],
      ['visible', 'hidden'],
      ['gone', 'visible'],
    ]);
  });
});
