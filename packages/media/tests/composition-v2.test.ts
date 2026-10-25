import { describe, expect, it } from 'vitest';
import { applyEasing, lerp } from '../src/animation/index.ts';
import { validateComposition } from '../src/composition-model/index.ts';
import {
  COMPOSITION_V2_LIMITS,
  type CompositionV2,
  compositionLeaves,
  resolveCompositionAt,
  resolveLayerWindows,
  sampleCompositionV2,
  upgradeComposition,
  validateAnimationV2,
  validateCompositionV2,
} from '../src/composition-v2/index.ts';

import hostile from './golden/composition-v2/hostile.json' with { type: 'json' };
import golden from './golden/composition-v2/lower-third.json' with { type: 'json' };

function goldenComposition(): CompositionV2 {
  const result = validateCompositionV2(golden.composition);
  if (!result.ok) throw new Error(JSON.stringify(result.errors));
  return result.composition;
}

const rect = (id: string, extra: Record<string, unknown> = {}) => ({
  id,
  type: 'shape',
  shape: 'rectangle',
  frame: { x: 0, y: 0, width: 10, height: 10 },
  fill: { kind: 'solid', color: '#000000' },
  ...extra,
});
const ids = (composition: { layers: readonly { id: string }[] }) =>
  composition.layers.map((layer) => layer.id);

describe('composition v2 validation', () => {
  it('accepts groups and layer timing and returns a fresh model', () => {
    const composition = goldenComposition();
    expect(composition.version).toBe(2);
    expect(composition).not.toBe(golden.composition);
    expect(composition.layers.map((layer) => layer.type)).toEqual(['shape', 'group', 'group']);
  });

  it('upgrades a v1 document through the unchanged v1 validator', () => {
    const v1 = { version: 1, width: 100, height: 50, durationMs: 0, layers: [rect('a')] };
    const result = validateCompositionV2(v1);
    expect(result).toMatchObject({ ok: true, composition: { version: 2, width: 100, height: 50 } });
    expect(result.ok && 'durationMs' in result.composition).toBe(false);
    const checked = validateComposition(v1);
    if (!checked.ok) throw new Error('v1');
    expect(upgradeComposition(checked.composition).layers).toEqual(checked.composition.layers);
  });

  it('fails every hostile golden closed with the pinned issues', () => {
    const EXPECTED: Record<string, string[]> = {
      'timing-without-duration': ['missing-field@layers[0].timing'],
      'end-before-start': ['invalid-value@layers[0].timing.endMs'],
      'end-past-duration': ['invalid-value@layers[0].timing.endMs'],
      'child-outside-group-window': ['invalid-value@layers[0].children[0].timing'],
      'duplicate-id-across-groups': ['duplicate-id@layers[1].children[0].id'],
      'empty-group': ['invalid-value@layers[0].children'],
      'group-with-transform-and-mask': [
        'unknown-field@layers[1].transform',
        'unknown-field@layers[1].mask',
      ],
      'mask-references-group': ['missing-mask@layers.b.mask.layerId'],
      'unsafe-nested-image': ['unsafe-source@layers[0].children[1].src'],
      'v1-with-timing': ['unknown-field@layers[0].timing'],
      'unknown-version': ['invalid-value@version'],
    };
    const cases = hostile.cases as { name: string; input: unknown }[];
    expect(cases.map((c) => c.name).sort()).toEqual(Object.keys(EXPECTED).sort());
    for (const hostile of cases) {
      const result = validateCompositionV2(hostile.input);
      expect(result.ok, hostile.name).toBe(false);
      if (!result.ok) {
        expect(
          result.errors.map((e) => `${e.code}@${e.path}`),
          hostile.name
        ).toEqual(EXPECTED[hostile.name]);
      }
    }
  });

  it('refuses a __proto__ key from JSON text and a node with a foreign prototype', () => {
    const text =
      '{"version":2,"width":10,"height":10,"layers":[{"id":"g","type":"group","__proto__":{"polluted":true},"children":[{"id":"a","type":"shape","shape":"rectangle","frame":{"x":0,"y":0,"width":1,"height":1},"fill":{"kind":"solid","color":"#000"}}]}]}';
    const fromText = validateCompositionV2(JSON.parse(text));
    expect(!fromText.ok && fromText.errors.map((e) => `${e.code}@${e.path}`)).toEqual([
      'unknown-field@layers[0].__proto__',
    ]);
    const foreign = Object.assign(Object.create({ polluted: true }), rect('a'));
    const fromObject = validateCompositionV2({
      version: 2,
      width: 10,
      height: 10,
      layers: [foreign],
    });
    expect(!fromObject.ok && fromObject.errors.map((e) => `${e.code}@${e.path}`)).toEqual([
      'invalid-value@layers[0]',
    ]);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  it('bounds nesting depth and the total number of layers and groups', () => {
    let node: Record<string, unknown> = rect('leaf');
    for (let depth = COMPOSITION_V2_LIMITS.maxDepth + 1; depth >= 1; depth -= 1) {
      node = { id: `g${depth}`, type: 'group', children: [node] };
    }
    const deep = validateCompositionV2({ version: 2, width: 10, height: 10, layers: [node] });
    expect(deep.ok).toBe(false);
    expect(!deep.ok && deep.errors.some((e) => e.code === 'limit-exceeded')).toBe(true);

    const wide = {
      version: 2,
      width: 10,
      height: 10,
      layers: [
        {
          id: 'g',
          type: 'group',
          children: Array.from({ length: COMPOSITION_V2_LIMITS.maxNodes }, (_, i) => rect(`l${i}`)),
        },
      ],
    };
    const tooMany = validateCompositionV2(wide);
    expect(!tooMany.ok && tooMany.errors.map((e) => e.code)).toEqual(['limit-exceeded']);
  });

  it('applies the untrusted image policy by default and the developer tier on request', () => {
    const doc = {
      version: 2,
      width: 10,
      height: 10,
      layers: [
        {
          id: 'g',
          type: 'group',
          children: [
            {
              id: 'pic',
              type: 'image',
              src: 'data:image/png;base64,iVBORw0KGgo=',
              alt: 'Swatch',
              frame: { x: 0, y: 0, width: 10, height: 10 },
            },
          ],
        },
      ],
    };
    expect(validateCompositionV2(doc).ok).toBe(false);
    expect(validateCompositionV2(doc, { trust: 'developer' }).ok).toBe(true);
  });
});

describe('composition v2 timing and layers', () => {
  it('resolves every leaf window through its groups', () => {
    expect(resolveLayerWindows(goldenComposition())).toEqual([
      { layerId: 'background', startMs: 0, endMs: 6000 },
      { layerId: 'title', startMs: 0, endMs: 2500 },
      { layerId: 'subtitle', startMs: 800, endMs: 2500 },
      { layerId: 'bar', startMs: 2000, endMs: 6000 },
      { layerId: 'speaker-name', startMs: 2000, endMs: 6000 },
      { layerId: 'logo-shape', startMs: 2000, endMs: 6000 },
      { layerId: 'logo', startMs: 2000, endMs: 6000 },
    ]);
  });

  it('shows what is on screen at each instant, with half-open windows and an inclusive end', () => {
    const composition = goldenComposition();
    const at = (t: number) => ids(resolveCompositionAt(composition, t));
    expect(at(0)).toEqual(['background', 'title']);
    expect(at(800)).toEqual(['background', 'title', 'subtitle']);
    expect(at(2200)).toEqual([
      'background',
      'title',
      'subtitle',
      'bar',
      'speaker-name',
      'logo-shape',
      'logo',
    ]);
    expect(at(2500)).toEqual(['background', 'bar', 'speaker-name', 'logo-shape', 'logo']);
    expect(at(6000)).toEqual(['background', 'bar', 'speaker-name', 'logo-shape', 'logo']);
    // Out-of-range and non-finite times clamp to the timeline.
    expect(at(-50)).toEqual(at(0));
    expect(at(99_999)).toEqual(at(6000));
    expect(at(Number.NaN)).toEqual(at(0));
  });

  it('moves leaves by nested group offsets and multiplies group opacity', () => {
    const snapshot = resolveCompositionAt(goldenComposition(), 3000);
    const byId = new Map(snapshot.layers.map((layer) => [layer.id, layer]));
    expect(byId.get('bar')?.frame).toEqual({ x: 48, y: 560, width: 640, height: 112 });
    expect(byId.get('speaker-name')?.frame).toMatchObject({ x: 192, y: 576 });
    expect(byId.get('speaker-name')?.opacity).toBeCloseTo(0.9);
    expect(byId.get('bar')?.opacity).toBeUndefined();
    expect(byId.get('logo')?.mask).toEqual({ layerId: 'logo-shape', mode: 'alpha' });
  });

  it('produces a valid v1 composition at every instant', () => {
    const composition = goldenComposition();
    const animation = validateAnimationV2(golden.animation, composition);
    if (!animation.ok) throw new Error('animation');
    for (let t = 0; t <= 6000; t += 125) {
      expect(validateComposition(resolveCompositionAt(composition, t)).ok, `${t}`).toBe(true);
      const sampled = sampleCompositionV2(composition, animation.animation, t);
      expect(validateComposition(sampled).ok, `sampled ${t}`).toBe(true);
    }
  });

  it('hides a layer whose mask is off screen, and shows an inverted one unmasked, down a chain', () => {
    const doc = validateCompositionV2({
      version: 2,
      width: 100,
      height: 100,
      durationMs: 1000,
      layers: [
        rect('c', { timing: { startMs: 0, endMs: 500 } }),
        rect('b', { mask: { layerId: 'c', mode: 'alpha' } }),
        rect('a', { mask: { layerId: 'b', mode: 'alpha' } }),
        rect('inv', { mask: { layerId: 'c', mode: 'alpha', invert: true } }),
      ],
    });
    if (!doc.ok) throw new Error(JSON.stringify(doc.errors));
    expect(ids(resolveCompositionAt(doc.composition, 100))).toEqual(['c', 'b', 'a', 'inv']);
    const late = resolveCompositionAt(doc.composition, 700);
    expect(ids(late)).toEqual(['inv']);
    expect(late.layers[0]?.mask).toBeUndefined();
  });

  it('clamps far-off nested offsets to the v1 frame bounds', () => {
    let node: Record<string, unknown> = rect('leaf', {
      frame: { x: 30_000, y: 0, width: 10, height: 10 },
    });
    for (let i = 0; i < 3; i += 1) {
      node = { id: `g${i}`, type: 'group', offset: { x: 30_000, y: 0 }, children: [node] };
    }
    const doc = validateCompositionV2({ version: 2, width: 10, height: 10, layers: [node] });
    if (!doc.ok) throw new Error('doc');
    const snapshot = resolveCompositionAt(doc.composition, 0);
    expect(snapshot.layers[0]?.frame.x).toBe(32_768);
    expect(validateComposition(snapshot).ok).toBe(true);
  });

  it('lists every leaf for preloading and provenance', () => {
    expect(ids(compositionLeaves(goldenComposition()))).toEqual([
      'background',
      'title',
      'subtitle',
      'bar',
      'speaker-name',
      'logo-shape',
      'logo',
    ]);
  });
});

describe('composition v2 animation', () => {
  it('animates group offset and opacity with easing, and leaves on the same clock', () => {
    const composition = goldenComposition();
    const check = validateAnimationV2(golden.animation, composition);
    if (!check.ok) throw new Error(JSON.stringify(check.errors));
    const progress = applyEasing(0.5, 'ease-out');
    const frame = sampleCompositionV2(composition, check.animation, 2300);
    const byId = new Map(frame.layers.map((layer) => [layer.id, layer]));
    expect(byId.get('bar')?.frame.x).toBeCloseTo(lerp(-640, 48, progress));
    expect(byId.get('bar')?.frame.y).toBeCloseTo(560);
    expect(byId.get('bar')?.opacity).toBeCloseTo(lerp(0, 1, progress));
    // Nested opacity multiplies the animated group opacity.
    expect(byId.get('speaker-name')?.opacity).toBeCloseTo(lerp(0, 1, progress) * 0.9);
    expect(byId.get('title')?.opacity).toBe(1);
    expect(sampleCompositionV2(composition, check.animation, 250).layers[1]?.opacity).toBeCloseTo(
      0.5
    );
  });

  it('freezes at the still frame under reduced motion, timing included', () => {
    const composition = goldenComposition();
    const check = validateAnimationV2(golden.animation, composition);
    if (!check.ok) throw new Error('animation');
    const still = sampleCompositionV2(composition, check.animation, 4000, {
      reducedMotion: true,
      stillTimeMs: 3000,
    });
    expect(still).toEqual(sampleCompositionV2(composition, check.animation, 3000));
    expect(ids(still)).not.toContain('title');
  });

  it('loops layer windows with the animation clock', () => {
    const composition = goldenComposition();
    const check = validateAnimationV2({ ...golden.animation, loop: true }, composition);
    if (!check.ok) throw new Error('animation');
    expect(ids(sampleCompositionV2(composition, check.animation, 6000 + 900))).toContain(
      'subtitle'
    );
  });

  it('accepts an animation whose tracks all target groups', () => {
    const check = validateAnimationV2(
      {
        version: 1,
        durationMs: 1000,
        tracks: [{ layerId: 'lower-third', keyframes: [{ timeMs: 0, opacity: 0 }] }],
      },
      goldenComposition()
    );
    expect(check.ok).toBe(true);
  });

  it('limits group tracks to opacity and translate, and maps leaf errors to their track', () => {
    const composition = goldenComposition();
    const bad = validateAnimationV2(
      {
        version: 1,
        durationMs: 1000,
        tracks: [
          { layerId: 'lower-third', keyframes: [{ timeMs: 0, scaleX: 2, fill: '#ffffff' }] },
          { layerId: 'title', keyframes: [{ timeMs: 0, opacity: 1 }] },
          { layerId: 'nope', keyframes: [{ timeMs: 0, opacity: 1 }] },
        ],
      },
      composition
    );
    expect(bad.ok).toBe(false);
    if (!bad.ok) {
      const paths = bad.errors.map((e) => e.path);
      expect(paths).toContain('tracks[0].keyframes[0].scaleX');
      expect(paths).toContain('tracks[0].keyframes[0].fill');
      expect(paths.some((path) => path.startsWith('tracks[2]'))).toBe(true);
      expect(paths.some((path) => path.startsWith('tracks[1]'))).toBe(false);
    }
  });
});
