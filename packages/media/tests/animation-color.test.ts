// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  isHexColor,
  mixOklch,
  sampleComposition,
  validateAnimation,
} from '../src/animation/index.ts';
import type { Composition, ShapeLayer, TextLayer } from '../src/composition-model/index.ts';

const composition: Composition = {
  version: 1,
  width: 200,
  height: 100,
  layers: [
    {
      id: 'box',
      type: 'shape',
      shape: 'rectangle',
      frame: { x: 0, y: 0, width: 100, height: 100 },
      fill: { kind: 'solid', color: '#ff0000' },
      stroke: { kind: 'solid', color: '#000000' },
      strokeWidth: 2,
    },
    {
      id: 'glow',
      type: 'shape',
      shape: 'ellipse',
      frame: { x: 100, y: 0, width: 100, height: 100 },
      fill: {
        kind: 'linear-gradient',
        angle: 0,
        stops: [
          { offset: 0, color: '#000000' },
          { offset: 1, color: '#ffffff' },
        ],
      },
    },
    {
      id: 'label',
      type: 'text',
      frame: { x: 0, y: 0, width: 200, height: 20 },
      text: 'Fictional label',
      paint: { kind: 'solid', color: '#222222' },
      fontSize: 14,
    },
    {
      id: 'photo',
      type: 'image',
      frame: { x: 0, y: 0, width: 10, height: 10 },
      src: 'https://example.com/photo.png',
      alt: 'Fictional photo',
    },
  ],
};

function layer<T>(sampled: Composition, id: string): T {
  return sampled.layers.find((item) => item.id === id) as T;
}

describe('mixOklch', () => {
  it('returns the ends at 0 and 1, in lowercase hex, and 6 related cases', () => {
    // returns the ends at 0 and 1, in lowercase hex
    expect(mixOklch('#FF0000', '#0000ff', 0)).toBe('#ff0000');
    expect(mixOklch('#ff0000', '#0000FF', 1)).toBe('#0000ff');
    expect(mixOklch('#f00', '#00f', 1)).toBe('#0000ff');
    {
      // keeps a red to blue fade vivid, unlike an sRGB mix
      const mid = mixOklch('#ff0000', '#0000ff', 0.5);
      const [r, g, b] = [1, 3, 5].map((at) => Number.parseInt(mid.slice(at, at + 2), 16));
      // An sRGB mix gives #800080 (a dull purple); OKLCH stays brighter and more saturated.
      expect(Math.max(r ?? 0, g ?? 0, b ?? 0)).toBeGreaterThan(0x80);
      expect(mid).not.toBe('#800080');
    }
    {
      // takes the shorter way round the hue circle
      // Red (hue ~29) to magenta (~328) passes through pink, not green.
      const mid = mixOklch('#ff0000', '#ff00ff', 0.5);
      const g = Number.parseInt(mid.slice(3, 5), 16);
      expect(g).toBeLessThan(0x40);
    }
    {
      // borrows the hue of the colored end when one end is gray
      const mid = mixOklch('#ffffff', '#0000ff', 0.5);
      const [r, g, b] = [1, 3, 5].map((at) => Number.parseInt(mid.slice(at, at + 2), 16));
      expect(b).toBeGreaterThan(r ?? 0);
      expect(b).toBeGreaterThan(g ?? 0);
    }
    // mixes alpha linearly and drops it when opaque
    expect(mixOklch('#00000000', '#000000ff', 0.5)).toBe('#00000080');
    expect(mixOklch('#000000', '#ffffff', 0.5)).toMatch(/^#[\da-f]{6}$/);
    // stays in gamut and clamps t
    for (let i = 0; i <= 10; i += 1) {
      expect(mixOklch('#00ff00', '#ff00ff', i / 10)).toMatch(/^#[\da-f]{6}$/);
    }
    expect(mixOklch('#ff0000', '#0000ff', -2)).toBe('#ff0000');
    expect(mixOklch('#ff0000', '#0000ff', 9)).toBe('#0000ff');
    expect(mixOklch('#ff0000', '#0000ff', Number.NaN)).toBe('#ff0000');
    // recognizes the hex forms the composition model accepts
    for (const ok of ['#abc', '#abcd', '#aabbcc', '#aabbccdd', '#ABCDEF'])
      expect(isHexColor(ok)).toBe(true);
    for (const bad of ['red', '#ab', '#abcde', 'url(x)', 'rgb(0,0,0)', '#gggggg', 7, null]) {
      expect(isHexColor(bad)).toBe(false);
    }
  });
});

describe('color keyframes', () => {
  const animation = {
    version: 1,
    durationMs: 1000,
    tracks: [
      {
        layerId: 'box',
        keyframes: [
          { timeMs: 0, fill: '#ff0000', stroke: '#000000' },
          { timeMs: 1000, fill: '#0000ff', stroke: '#ffffff', easing: 'linear' },
        ],
      },
      { layerId: 'label', keyframes: [{ timeMs: 0 }, { timeMs: 1000, fill: '#ffffff' }] },
      {
        layerId: 'glow',
        keyframes: [{ timeMs: 0 }, { timeMs: 500, fill: '#00ff00' }, { timeMs: 1000 }],
      },
    ],
  };
  it('validates hex fill and stroke against the layer types, and 6 related cases', () => {
    {
      // validates hex fill and stroke against the layer types
      const result = validateAnimation(animation, { composition });
      expect(result.ok).toBe(true);
      if (result.ok)
        expect(result.animation.tracks[0]?.keyframes[1]).toMatchObject({
          fill: '#0000ff',
          stroke: '#ffffff',
        });
    }
    // rejects
    for (const [_name, extra, key] of [
      ['a named color', { fill: 'red' }, 'fill'],
      ['a CSS function', { fill: 'url(javascript:alert(1))' }, 'fill'],
      ['a short hex', { stroke: '#12' }, 'stroke'],
      ['a non-string', { fill: 0xff0000 }, 'fill'],
    ] as const) {
      const result = validateAnimation({
        version: 1,
        durationMs: 1000,
        tracks: [{ layerId: 'box', keyframes: [{ timeMs: 0, ...extra }] }],
      });
      expect(result.ok, String(_name)).toBe(false);
      if (!result.ok)
        expect(
          result.errors.map((error) => error.path),
          String(_name)
        ).toContain(`tracks[0].keyframes[0].${key}`);
    }
    {
      // rejects colors a layer cannot paint
      const fillImage = validateAnimation(
        {
          version: 1,
          durationMs: 100,
          tracks: [{ layerId: 'photo', keyframes: [{ timeMs: 0, fill: '#fff' }] }],
        },
        { composition }
      );
      expect(fillImage.ok).toBe(false);
      const strokeText = validateAnimation(
        {
          version: 1,
          durationMs: 100,
          tracks: [{ layerId: 'label', keyframes: [{ timeMs: 0, stroke: '#fff' }] }],
        },
        { composition }
      );
      expect(strokeText.ok).toBe(false);
    }
    {
      // samples fill and stroke in OKLCH and writes solid paints
      const valid = validateAnimation(animation, { composition });
      if (!valid.ok) throw new Error('expected valid');
      const start = sampleComposition(composition, valid.animation, 0);
      expect(layer<ShapeLayer>(start, 'box').fill).toEqual({ kind: 'solid', color: '#ff0000' });
      const mid = sampleComposition(composition, valid.animation, 500);
      expect(layer<ShapeLayer>(mid, 'box').fill).toEqual({
        kind: 'solid',
        color: mixOklch('#ff0000', '#0000ff', 0.5),
      });
      expect(layer<ShapeLayer>(mid, 'box').stroke).toEqual({
        kind: 'solid',
        color: mixOklch('#000000', '#ffffff', 0.5),
      });
      const end = sampleComposition(composition, valid.animation, 1000);
      expect(layer<ShapeLayer>(end, 'box').fill).toEqual({ kind: 'solid', color: '#0000ff' });
    }
    {
      // starts a text paint from the layer color and animates it
      const valid = validateAnimation(animation, { composition });
      if (!valid.ok) throw new Error('expected valid');
      expect(
        layer<TextLayer>(sampleComposition(composition, valid.animation, 0), 'label').paint
      ).toEqual({ kind: 'solid', color: '#222222' });
      expect(
        layer<TextLayer>(sampleComposition(composition, valid.animation, 500), 'label').paint
      ).toEqual({
        kind: 'solid',
        color: mixOklch('#222222', '#ffffff', 0.5),
      });
    }
    {
      // keeps a gradient until the first color keyframe, then holds the color
      const valid = validateAnimation(animation, { composition });
      if (!valid.ok) throw new Error('expected valid');
      const glowAt = (time: number) =>
        layer<ShapeLayer>(sampleComposition(composition, valid.animation, time), 'glow').fill;
      expect(glowAt(250)?.kind).toBe('linear-gradient');
      expect(glowAt(500)).toEqual({ kind: 'solid', color: '#00ff00' });
      expect(glowAt(900)).toEqual({ kind: 'solid', color: '#00ff00' });
    }
    {
      // leaves layers without color keyframes untouched
      const plain = validateAnimation({
        version: 1,
        durationMs: 100,
        tracks: [{ layerId: 'box', keyframes: [{ timeMs: 0, opacity: 0.5 }] }],
      });
      if (!plain.ok) throw new Error('expected valid');
      const sampled = sampleComposition(composition, plain.animation, 50);
      expect(layer<ShapeLayer>(sampled, 'box').fill).toEqual({ kind: 'solid', color: '#ff0000' });
      expect(layer<ShapeLayer>(sampled, 'glow')).toBe(composition.layers[1]);
    }
  });
});
