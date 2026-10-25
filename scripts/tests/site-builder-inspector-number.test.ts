import { describe, expect, it } from 'vitest';
import {
  describeBounds,
  isNumberProp,
  type NumberBounds,
  type NumberProp,
  numberControl,
  numberIssues,
  parseNumberInput,
  readNumber,
  shownDefault,
  showRaw,
  sliderStep,
  withinBounds,
} from '../../apps/website/src/components/builder/inspector/number/model.ts';
import {
  chartNumberHints,
  chartPropSchemas,
  numberHints,
  paintNumberHints,
} from '../../apps/website/src/components/builder/inspector/number/sources.ts';
import { BUILDER_MANIFESTS } from '../../apps/website/src/components/builder/manifest.ts';
import { activeHighlightIndex } from '../../packages/blocks/src/code/token-styles.ts';
import { canvasBackingSize } from '../../packages/media/src/composition-canvas/geometry.ts';
import { IMAGE_LIMITS, intrinsicSize } from '../../packages/media/src/image/model.ts';

/** Every number prop the builder can edit, from the real manifests. */
const NUMBER_PROPS: { id: string; prop: NumberProp }[] = BUILDER_MANIFESTS.flatMap((manifest) =>
  manifest.props.filter(isNumberProp).map((prop) => ({ id: manifest.id, prop }))
);

const HOSTILE: unknown[] = [
  JSON.parse('1e400'),
  JSON.parse('-1e400'),
  Number.NaN,
  '12',
  '',
  ' 3 ',
  '1e3',
  null,
  true,
  false,
  {},
  [],
  [1],
  { value: 1 },
  '<b>1</b>',
  '__proto__',
  'x'.repeat(10_000),
];
const FINITE = [0, -0, 1, -1, 0.5, 1e6, -1e6, Number.MAX_SAFE_INTEGER, Number.MIN_VALUE];

/** The renderer's rule for `kind: 'number'`, written out independently of it. */
function oracle(value: unknown): 'unset' | 'set' | 'invalid' {
  if (value === undefined) return 'unset';
  return typeof value === 'number' && Number.isFinite(value) ? 'set' : 'invalid';
}

describe('number props in the builder manifests', () => {
  it('covers every number prop the builder edits', () => {
    // PLAN_005 task 5 adds the grid tile's span and rowSpan.
    expect(NUMBER_PROPS.length).toBe(46);
  });

  it('reads every value exactly as the renderer will: unset, accepted or refused', () => {
    let checked = 0;
    for (const { id, prop } of NUMBER_PROPS) {
      for (const value of [undefined, ...FINITE, ...HOSTILE]) {
        const reading = readNumber(prop, value);
        expect(reading.state, `${id}.${prop.name} = ${showRaw(value)}`).toBe(oracle(value));
        const errors = numberIssues(prop, value, chartNumberHints(id, prop.name)).filter(
          (issue) => issue.severity === 'error'
        );
        if (reading.state === 'invalid') expect(errors).toHaveLength(1);
        if (reading.state === 'set') expect(errors).toHaveLength(0);
        if (reading.state === 'unset') expect(errors).toHaveLength(prop.required ? 1 : 0);
        checked += 1;
      }
    }
    expect(checked).toBeGreaterThan(1000);
  });
});

describe('schema hints', () => {
  it('reads bounds and defaults from the chart schemas, and only from them', () => {
    for (const { id, prop } of NUMBER_PROPS) {
      const hints = chartNumberHints(id, prop.name);
      const schema = (
        chartPropSchemas as Record<string, { props: readonly Record<string, unknown>[] }>
      )[id];
      const source = schema?.props.find((candidate) => candidate.name === prop.name);
      if (!source) {
        expect(hints, `${id}.${prop.name}`).toBeUndefined();
        continue;
      }
      const c = (source.constraints ?? {}) as Record<string, number | boolean | undefined>;
      expect(hints?.default).toBe(typeof source.default === 'number' ? source.default : undefined);
      expect(hints?.bounds?.min).toBe(c.exclusiveMinimum ?? c.minimum);
      expect(hints?.bounds?.exclusive).toBe(c.exclusiveMinimum !== undefined ? true : undefined);
      expect(hints?.bounds?.max).toBe(c.maximum);
    }
    expect(chartNumberHints('media-image', 'width')).toBeUndefined();
    expect(chartNumberHints('charts-canvas-renderer', 'width')).toBeUndefined();
    expect(chartNumberHints('charts-gauge', 'not-a-prop')).toBeUndefined();
  });

  it('warns, never errors, outside a documented range, around every bound', () => {
    let bounded = 0;
    for (const { id, prop } of NUMBER_PROPS) {
      const hints = chartNumberHints(id, prop.name);
      const bounds = hints?.bounds;
      if (!bounds || bounds.min === undefined) continue;
      bounded += 1;
      for (const value of [bounds.min - 1, bounds.min, bounds.min + 0.001, bounds.min + 1000]) {
        const inside = bounds.exclusive ? value > bounds.min : value >= bounds.min;
        const issues = numberIssues(prop, value, hints);
        expect(
          issues.some((issue) => issue.severity === 'error'),
          `${id}.${prop.name}=${value}`
        ).toBe(false);
        expect(
          issues.some((issue) => issue.severity === 'warning'),
          `${id}.${prop.name}=${value}`
        ).toBe(!inside);
      }
    }
    expect(bounded).toBe(29);
  });

  it('shows the manifest default first, then the schema default, and never writes either', () => {
    const columns = NUMBER_PROPS.find(
      (entry) => entry.id === 'layout-grid' && entry.prop.name === 'columns'
    );
    const size = NUMBER_PROPS.find(
      (entry) => entry.id === 'charts-gauge' && entry.prop.name === 'size'
    );
    const width = NUMBER_PROPS.find(
      (entry) => entry.id === 'media-image' && entry.prop.name === 'width'
    );
    if (!columns || !size || !width) throw new Error('fixture props missing');
    expect(shownDefault(columns.prop, chartNumberHints(columns.id, 'columns'))).toBe(2);
    expect(shownDefault(size.prop, chartNumberHints(size.id, 'size'))).toBe(144);
    expect(shownDefault(width.prop, chartNumberHints(width.id, 'width'))).toBeUndefined();
  });
});

describe('controls and input', () => {
  it('uses number inputs today: no builder prop documents both ends of a range', () => {
    const sliders = NUMBER_PROPS.filter(
      ({ id, prop }) => numberControl(chartNumberHints(id, prop.name)) === 'slider'
    );
    expect(sliders).toEqual([]);
  });

  it('switches to a slider only for a two-sided inclusive range', () => {
    const ratio: NumberBounds = { min: 0, max: 0.85 };
    expect(numberControl({ bounds: ratio, source: 'test' })).toBe('slider');
    expect(sliderStep(ratio)).toBeCloseTo(0.0085);
    expect(sliderStep({ min: 0, max: 6, integer: true })).toBe(1);
    expect(numberControl({ bounds: { min: 0, exclusive: true, max: 1 }, source: 'test' })).toBe(
      'input'
    );
    expect(numberControl({ bounds: { min: 0 }, source: 'test' })).toBe('input');
    expect(numberControl(undefined)).toBe('input');
  });

  it('stores only finite numbers typed into the box', () => {
    const optional = { name: 'size', kind: 'number' } as NumberProp;
    const required = { name: 'value', kind: 'number', required: true } as NumberProp;
    expect(parseNumberInput(optional, '')).toEqual({ ok: true, value: undefined });
    expect(parseNumberInput(required, '  ')).toEqual({
      ok: false,
      message: 'Required: enter a number.',
    });
    expect(parseNumberInput(optional, ' 12 ')).toEqual({ ok: true, value: 12 });
    expect(parseNumberInput(optional, '-0.5')).toEqual({ ok: true, value: -0.5 });
    expect(parseNumberInput(optional, '1e3')).toEqual({ ok: true, value: 1000 });
    for (const bad of ['abc', 'Infinity', '-Infinity', '1e400', 'NaN', '1,5', '0x']) {
      expect(parseNumberInput(optional, bad), bad).toEqual({
        ok: false,
        message: 'Enter a finite number.',
      });
    }
  });

  it('describes ranges in plain words and checks them', () => {
    expect(describeBounds({ min: 0, exclusive: true })).toBe('greater than 0');
    expect(describeBounds({ min: 0 })).toBe('at least 0');
    expect(describeBounds({ min: 0, max: 0.85 })).toBe('0 to 0.85');
    expect(describeBounds({ min: 0, max: 6, integer: true })).toBe('0 to 6, a whole number');
    expect(describeBounds({})).toBeUndefined();
    expect(withinBounds(0, { min: 0, exclusive: true })).toBe(false);
    expect(withinBounds(0, { min: 0 })).toBe(true);
    expect(withinBounds(2.5, { min: 0, max: 6, integer: true })).toBe(false);
    expect(withinBounds(7, { min: 0, max: 6 })).toBe(false);
  });

  it('shows refused values as short JSON text', () => {
    expect(showRaw('12')).toBe('"12"');
    expect(showRaw(Number.POSITIVE_INFINITY)).toBe('null');
    expect([...showRaw('x'.repeat(10_000))].length).toBe(61);
  });
});

describe('painting-code hints (PLAN_005 task 5)', () => {
  const at = (id: string, name: string) => {
    const entry = NUMBER_PROPS.find(
      (candidate) => candidate.id === id && candidate.prop.name === name
    );
    if (!entry) throw new Error(`${id}.${name} missing`);
    return entry.prop;
  };

  it('gives every builder number prop a documented range except the canvas renderer size', () => {
    const bare = NUMBER_PROPS.filter(({ id, prop }) => !numberHints(id, prop.name)).map(
      ({ id, prop }) => `${id}.${prop.name}`
    );
    // CanvasRenderer passes width and height straight to the canvas element: no rule to show.
    expect(bare).toEqual(['charts-canvas-renderer.width', 'charts-canvas-renderer.height']);
    // The chart schema wins wherever it has an entry.
    for (const { id, prop } of NUMBER_PROPS) {
      const chart = chartNumberHints(id, prop.name);
      if (chart) expect(numberHints(id, prop.name)).toEqual(chart);
    }
  });

  it('matches the clamps in the painting code', () => {
    expect(paintNumberHints('layout-grid', 'columns')?.bounds).toEqual({
      min: 1,
      max: 4,
      integer: true,
    });
    expect(paintNumberHints('layout-tile', 'span')?.bounds).toEqual({
      min: 1,
      max: 4,
      integer: true,
    });
    expect(paintNumberHints('layout-tile', 'rowSpan')?.bounds).toEqual({
      min: 1,
      max: 2,
      integer: true,
    });
    expect(paintNumberHints('blocks-map', 'headingLevel')?.bounds).toEqual({
      min: 1,
      max: 6,
      integer: true,
    });
    // The image limit is the media package's own constant, and intrinsicSize enforces it.
    expect(paintNumberHints('media-image', 'width')?.bounds?.max).toBe(IMAGE_LIMITS.dimension);
    expect(intrinsicSize(IMAGE_LIMITS.dimension, 10)).toBeDefined();
    expect(intrinsicSize(IMAGE_LIMITS.dimension + 1, 10)).toBeUndefined();
    expect(intrinsicSize(0, 10)).toBeUndefined();
    // The canvas caps its ratio at 4 and falls back to 1 at 0 or below.
    expect(paintNumberHints('media-composition-canvas', 'pixelRatio')?.bounds).toEqual({
      min: 0,
      exclusive: true,
      max: 4,
    });
    expect(canvasBackingSize(100, 100, 8)).toEqual(canvasBackingSize(100, 100, 4));
    expect(canvasBackingSize(100, 100, 0)).toEqual(canvasBackingSize(100, 100, 1));
    // Code steps count from 0: a negative step reads as the first one.
    expect(activeHighlightIndex(3, -2)).toBe(0);
    expect(paintNumberHints('blocks-code', 'step')?.bounds).toEqual({ min: 0, integer: true });
  });

  it('turns two-sided ranges into sliders and warns outside them', () => {
    const columns = at('layout-grid', 'columns');
    const hints = numberHints('layout-grid', 'columns');
    expect(numberControl(hints)).toBe('slider');
    expect(numberIssues(columns, 3, hints)).toEqual([]);
    expect(numberIssues(columns, 6, hints)).toEqual([
      {
        severity: 'warning',
        message:
          'Outside the documented range (1 to 4, a whole number); it may not paint as intended.',
      },
    ]);
    expect(numberControl(numberHints('media-composition-canvas', 'pixelRatio'))).toBe('input');
    expect(shownDefault(at('layout-tile', 'rowSpan'), numberHints('layout-tile', 'rowSpan'))).toBe(
      1
    );
  });
});
