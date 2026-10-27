import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  applyMatrix,
  applyViewportAction,
  CANVAS_LIMITS,
  CompositionCanvas,
  type CompositionContext2D,
  type CompositionImage,
  canvasBackingSize,
  clampViewport,
  describeComposition,
  fitImage,
  layerBounds,
  layerMatrix,
  linearGradientLine,
  radialGradientCircle,
  type ScratchSurface,
  viewportKeyAction,
  wrapText,
  zoomViewport,
} from '../src/composition-canvas/index.ts';
import { drawComposition, loadCompositionImages } from '../src/composition-canvas/pipeline.ts';
import { renderComposition } from '../src/composition-canvas/render.ts';
import type { Composition, CompositionLayer } from '../src/composition-model/index.ts';

// ---------------------------------------------------------------------------
// A recording 2D context: every call is logged with the state that matters
// at that moment (alpha, blend, transform, styles), so tests assert what a
// real canvas would have been asked to paint.
// ---------------------------------------------------------------------------

interface Call {
  op: string;
  args: unknown[];
  alpha: number;
  blend: GlobalCompositeOperation;
  matrix: number[];
  fillStyle: unknown;
  strokeStyle: unknown;
  textAlign: CanvasTextAlign;
  direction: CanvasDirection;
  font: string;
}

type Paint = string | CanvasGradient | CanvasPattern;

class FakeGradient {
  readonly stops: [number, string][] = [];
  readonly kind: string;
  readonly args: number[];
  constructor(kind: string, args: number[]) {
    this.kind = kind;
    this.args = args;
  }
  addColorStop(offset: number, color: string) {
    this.stops.push([offset, color]);
  }
}

function fakeContext(
  options: { width?: number; height?: number; pixels?: Uint8ClampedArray; taint?: boolean } = {}
) {
  const calls: Call[] = [];
  const stack: Record<string, unknown>[] = [];
  const state = {
    globalAlpha: 1,
    globalCompositeOperation: 'source-over' as GlobalCompositeOperation,
    fillStyle: '#000' as Paint,
    strokeStyle: '#000' as Paint,
    lineWidth: 1,
    font: '10px sans-serif',
    textAlign: 'start' as CanvasTextAlign,
    textBaseline: 'alphabetic' as CanvasTextBaseline,
    direction: 'inherit' as CanvasDirection,
    matrix: [1, 0, 0, 1, 0, 0],
  };
  let putData: ImageData | null = null;
  const log = (op: string, args: unknown[]) =>
    calls.push({
      op,
      args,
      alpha: state.globalAlpha,
      blend: state.globalCompositeOperation,
      matrix: [...state.matrix],
      fillStyle: state.fillStyle,
      strokeStyle: state.strokeStyle,
      textAlign: state.textAlign,
      direction: state.direction,
      font: state.font,
    });
  const context = {
    get globalAlpha() {
      return state.globalAlpha;
    },
    set globalAlpha(v: number) {
      state.globalAlpha = v;
    },
    get globalCompositeOperation() {
      return state.globalCompositeOperation;
    },
    set globalCompositeOperation(v: GlobalCompositeOperation) {
      state.globalCompositeOperation = v;
    },
    get fillStyle() {
      return state.fillStyle;
    },
    set fillStyle(v: Paint) {
      state.fillStyle = v;
    },
    get strokeStyle() {
      return state.strokeStyle;
    },
    set strokeStyle(v: Paint) {
      state.strokeStyle = v;
    },
    get lineWidth() {
      return state.lineWidth;
    },
    set lineWidth(v: number) {
      state.lineWidth = v;
    },
    get font() {
      return state.font;
    },
    set font(v: string) {
      state.font = v;
    },
    get textAlign() {
      return state.textAlign;
    },
    set textAlign(v: CanvasTextAlign) {
      state.textAlign = v;
    },
    get textBaseline() {
      return state.textBaseline;
    },
    set textBaseline(v: CanvasTextBaseline) {
      state.textBaseline = v;
    },
    get direction() {
      return state.direction;
    },
    set direction(v: CanvasDirection) {
      state.direction = v;
    },
    save() {
      stack.push({ ...state, matrix: [...state.matrix] });
      log('save', []);
    },
    restore() {
      const saved = stack.pop();
      if (saved) Object.assign(state, saved);
      log('restore', []);
    },
    setTransform(...m: number[]) {
      state.matrix = m;
    },
    clearRect: (...a: number[]) => log('clearRect', a),
    fillRect: (...a: number[]) => log('fillRect', a),
    beginPath: () => log('beginPath', []),
    rect: (...a: number[]) => log('rect', a),
    ellipse: (...a: number[]) => log('ellipse', a),
    moveTo: (...a: number[]) => log('moveTo', a),
    lineTo: (...a: number[]) => log('lineTo', a),
    fill: () => log('fill', []),
    stroke: () => log('stroke', [state.lineWidth]),
    clip: () => log('clip', []),
    fillText: (...a: unknown[]) => log('fillText', a),
    // Every character advances 10 units: easy to reason about line breaks.
    measureText: (text: string) => ({ width: Array.from(text).length * 10 }),
    drawImage: (...a: unknown[]) => log('drawImage', a),
    createLinearGradient: (...a: number[]) =>
      new FakeGradient('linear', a) as unknown as CanvasGradient,
    createRadialGradient: (...a: number[]) =>
      new FakeGradient('radial', a) as unknown as CanvasGradient,
    getImageData: (...a: number[]) => {
      log('getImageData', a);
      if (options.taint) throw new DOMException('Tainted canvas', 'SecurityError');
      return {
        data: options.pixels ?? new Uint8ClampedArray(4),
        width: 1,
        height: 1,
      } as unknown as ImageData;
    },
    putImageData: (data: ImageData, ...a: number[]) => {
      putData = data;
      log('putImageData', a);
    },
  } satisfies CompositionContext2D;
  return { context, calls, ops: () => calls.map((c) => c.op), put: () => putData };
}

function scratchFactory(options: Parameters<typeof fakeContext>[0] = {}) {
  const made: ReturnType<typeof fakeContext>[] = [];
  const factory = (width: number, height: number): ScratchSurface => {
    const fake = fakeContext({ ...options, width, height });
    made.push(fake);
    return {
      context: fake.context,
      image: { id: `scratch-${made.length}` } as unknown as CanvasImageSource,
    };
  };
  return { factory, made };
}

const rect = (id: string, extra: Partial<CompositionLayer> = {}): CompositionLayer =>
  ({
    id,
    type: 'shape',
    shape: 'rectangle',
    frame: { x: 10, y: 20, width: 100, height: 50 },
    fill: { kind: 'solid', color: '#336699' },
    ...extra,
  }) as CompositionLayer;

const scene = (layers: CompositionLayer[], width = 400, height = 300): Composition => ({
  version: 1,
  width,
  height,
  layers,
});

const image = (width = 200, height = 100): CompositionImage => ({
  source: { tag: 'img' } as unknown as CanvasImageSource,
  width,
  height,
});

const close = (a: number, b: number) => expect(a).toBeCloseTo(b, 6);

// ---------------------------------------------------------------------------

describe('geometry', () => {
  it('applies the layer transform around the frame center, and 7 related cases', () => {
    {
      // applies the layer transform around the frame center
      const frame = { x: 0, y: 0, width: 100, height: 50 };
      const rotated = layerMatrix(frame, { rotateDeg: 90 });
      const corner = applyMatrix(rotated, 0, 0);
      // The top-left corner turns about (50, 25): it lands at (75, -25).
      close(corner.x, 75);
      close(corner.y, -25);
      const center = applyMatrix(rotated, 50, 25);
      close(center.x, 50);
      close(center.y, 25);

      const moved = layerMatrix(frame, { translateX: 5, translateY: -5, scaleX: 2, scaleY: 0.5 });
      const point = applyMatrix(moved, 100, 50);
      close(point.x, 155);
      close(point.y, 32.5);
      expect(layerMatrix(frame)).toEqual({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 });
    }
    cleanup();
    vi.restoreAllMocks();
    {
      // bounds a rotated layer and pads strokes and lines
      const square = rect('sq', {
        frame: { x: 0, y: 0, width: 100, height: 100 },
        transform: { rotateDeg: 45 },
      });
      const bounds = layerBounds(square);
      close(bounds.width, Math.SQRT2 * 100);
      close(bounds.x, 50 - (Math.SQRT2 * 100) / 2);

      const line = {
        id: 'ln',
        type: 'shape',
        shape: 'line',
        frame: { x: 0, y: 10, width: 100, height: 1 },
        stroke: { kind: 'solid', color: '#000000' },
        strokeWidth: 8,
      } as CompositionLayer;
      expect(layerBounds(line)).toEqual({ x: -4, y: 6, width: 108, height: 9 });
    }
    cleanup();
    vi.restoreAllMocks();
    {
      // places CSS-style linear gradient lines
      const frame = { x: 0, y: 0, width: 200, height: 100 };
      const right = linearGradientLine(frame, { angle: 90 });
      close(right.x0, 0);
      close(right.x1, 200);
      close(right.y0, 50);
      const up = linearGradientLine(frame, { angle: 0 });
      close(up.y0, 100);
      close(up.y1, 0);
      const diagonal = linearGradientLine({ x: 0, y: 0, width: 100, height: 100 }, { angle: 135 });
      close(diagonal.x0, 0);
      close(diagonal.y0, 0);
      close(diagonal.x1, 100);
      close(diagonal.y1, 100);
    }
    cleanup();
    vi.restoreAllMocks();
    {
      // normalizes radial gradients to the frame
      const circle = radialGradientCircle(
        { x: 10, y: 10, width: 100, height: 100 },
        { center: { x: 0.5, y: 0.25 }, radius: 0.5 }
      );
      expect(circle.x).toBe(60);
      expect(circle.y).toBe(35);
      close(circle.r, 50);
    }
    cleanup();
    vi.restoreAllMocks();
    {
      // fits images like object-fit
      const frame = { x: 0, y: 0, width: 100, height: 100 };
      expect(fitImage(frame, { width: 200, height: 100 }, 'contain')).toEqual({
        x: 0,
        y: 25,
        width: 100,
        height: 50,
      });
      expect(fitImage(frame, { width: 200, height: 100 }, 'cover')).toEqual({
        x: -50,
        y: 0,
        width: 200,
        height: 100,
      });
      expect(fitImage(frame, { width: 200, height: 100 }, 'fill')).toEqual(frame);
      expect(fitImage(frame, { width: 200, height: 100 })).toEqual({
        x: -50,
        y: 0,
        width: 200,
        height: 100,
      });
    }
    cleanup();
    vi.restoreAllMocks();
    {
      // caps the backing store to browser canvas limits
      expect(canvasBackingSize(400, 300, 2)).toEqual({ width: 800, height: 600, scale: 2 });
      const huge = canvasBackingSize(8192, 8192, 2);
      expect(huge.width * huge.height).toBeLessThanOrEqual(CANVAS_LIMITS.maxArea);
      expect(huge.width).toBe(4096);
      expect(canvasBackingSize(100, 100, Number.NaN).scale).toBe(1);
      expect(canvasBackingSize(100, 100, -3).scale).toBe(1);
      expect(canvasBackingSize(100, 100, 50).scale).toBe(4);
      expect(canvasBackingSize(8000, 100, 4).width).toBeLessThanOrEqual(CANVAS_LIMITS.maxSide);
    }
    cleanup();
    vi.restoreAllMocks();
    {
      // wraps text by words, breaks long words, keeps newlines and caps lines
      const measure = (value: string) => Array.from(value).length * 10;
      expect(wrapText('alpha beta gamma', 110, measure)).toEqual(['alpha beta', 'gamma']);
      expect(wrapText('abcdefghij', 40, measure)).toEqual(['abcd', 'efgh', 'ij']);
      expect(wrapText('one\ntwo', 1000, measure)).toEqual(['one', 'two']);
      expect(wrapText('a b c d e', 10, measure, 2)).toEqual(['a', 'b']);
      expect(wrapText('', 100, measure)).toEqual(['']);
    }
    cleanup();
    vi.restoreAllMocks();
    {
      // never splits a grapheme cluster when breaking a long word
      const family = '\u{1F468}\u200d\u{1F469}\u200d\u{1F467}';
      const lines = wrapText(`${family}${family}`, 1, (value) => value.length);
      expect(lines).toEqual([family, family]);
    }
  });
});

describe('drawComposition', () => {
  it('clears, paints the background and draws layers bottom first, and 15 related cases', () => {
    {
      // clears, paints the background and draws layers bottom first
      const fake = fakeContext();
      const report = drawComposition(fake.context, scene([rect('a'), rect('b')]), {
        background: '#ffffff',
      });
      expect(fake.calls.find((c) => c.op === 'clearRect')?.args).toEqual([0, 0, 400, 300]);
      expect(fake.calls.find((c) => c.op === 'fillRect')?.fillStyle).toBe('#ffffff');
      expect(report.drawn).toEqual(['a', 'b']);
      expect(fake.ops().filter((op) => op === 'fill')).toHaveLength(2);
    }
    cleanup();
    vi.restoreAllMocks();
    {
      // applies opacity and blend mode while painting, then restores them
      const fake = fakeContext();
      drawComposition(
        fake.context,
        scene([rect('a', { opacity: 0.4, blendMode: 'multiply' }), rect('b')])
      );
      const fills = fake.calls.filter((c) => c.op === 'fill');
      expect(fills[0]).toMatchObject({ alpha: 0.4, blend: 'multiply' });
      expect(fills[1]).toMatchObject({ alpha: 1, blend: 'source-over' });
      expect(fake.context.globalAlpha).toBe(1);
    }
    cleanup();
    vi.restoreAllMocks();
    {
      // maps every blend mode onto the canvas operation of the same name
      const fake = fakeContext();
      drawComposition(
        fake.context,
        scene([rect('a', { blendMode: 'normal' }), rect('b', { blendMode: 'luminosity' })])
      );
      const fills = fake.calls.filter((c) => c.op === 'fill');
      expect(fills.map((c) => c.blend)).toEqual(['source-over', 'luminosity']);
    }
    cleanup();
    vi.restoreAllMocks();
    {
      // draws in device pixels with the layer transform
      const fake = fakeContext();
      drawComposition(fake.context, scene([rect('a', { transform: { translateX: 10 } })]), {
        scale: 2,
      });
      const fill = fake.calls.find((c) => c.op === 'fill');
      expect(fill?.matrix).toEqual([2, 0, 0, 2, 20, 0]);
    }
    cleanup();
    vi.restoreAllMocks();
    {
      // pans and zooms through the viewport and culls layers outside it
      const fake = fakeContext();
      const layers = [
        rect('inside', { frame: { x: 210, y: 160, width: 20, height: 20 } }),
        rect('outside', { frame: { x: 0, y: 0, width: 20, height: 20 } }),
      ];
      const report = drawComposition(fake.context, scene(layers), {
        viewport: { x: 200, y: 150, zoom: 2 },
      });
      expect(report.drawn).toEqual(['inside']);
      expect(report.culled).toEqual(['outside']);
      expect(fake.calls.find((c) => c.op === 'fill')?.matrix).toEqual([2, 0, 0, 2, -400, -300]);
    }
    cleanup();
    vi.restoreAllMocks();
    {
      // paints ellipses, lines and gradients from the frame
      const fake = fakeContext();
      const layers = [
        rect('oval', {
          shape: 'ellipse',
          fill: {
            kind: 'linear-gradient',
            angle: 90,
            stops: [
              { offset: 0, color: '#000000' },
              { offset: 1, color: '#ffffff' },
            ],
          },
        } as Partial<CompositionLayer>),
        {
          id: 'rule',
          type: 'shape',
          shape: 'line',
          frame: { x: 0, y: 0, width: 50, height: 10 },
          fill: { kind: 'solid', color: '#123456' },
          strokeWidth: 3,
        } as CompositionLayer,
        rect('glow', {
          fill: {
            kind: 'radial-gradient',
            center: { x: 0.5, y: 0.5 },
            radius: 1,
            stops: [
              { offset: 0, color: '#ff0000' },
              { offset: 1, color: '#0000ff' },
            ],
          },
          stroke: { kind: 'solid', color: '#000000' },
          strokeWidth: 0,
        } as Partial<CompositionLayer>),
      ];
      const report = drawComposition(fake.context, scene(layers));
      expect(report.drawn).toEqual(['oval', 'rule', 'glow']);
      expect(fake.calls.find((c) => c.op === 'ellipse')?.args).toEqual([
        60,
        45,
        50,
        25,
        0,
        0,
        Math.PI * 2,
      ]);
      const fills = fake.calls.filter((c) => c.op === 'fill');
      const linear = fills[0]?.fillStyle as unknown as FakeGradient;
      expect(linear.kind).toBe('linear');
      expect(linear.args).toEqual([10, 45, 110, 45]);
      expect(linear.stops).toEqual([
        [0, '#000000'],
        [1, '#ffffff'],
      ]);
      // The line has only a fill: it is stroked with it, 3 units wide.
      const line = fake.calls.find((c) => c.op === 'stroke');
      expect(line?.strokeStyle).toBe('#123456');
      expect(line?.args).toEqual([3]);
      expect(fake.calls.find((c) => c.op === 'lineTo')?.args).toEqual([50, 10]);
      const radial = fills[1]?.fillStyle as unknown as FakeGradient | undefined;
      expect(radial?.kind).toBe('radial');
      // strokeWidth 0 means no stroke for the third layer.
      expect(fake.ops().filter((op) => op === 'stroke')).toHaveLength(1);
    }
    cleanup();
    vi.restoreAllMocks();
    {
      // draws untrusted text as text, wrapped, clipped and aligned by direction
      const fake = fakeContext();
      const hostile = '<img src=x onerror=alert(1)>';
      const layer = {
        id: 'title',
        type: 'text',
        frame: { x: 0, y: 0, width: 100, height: 40 },
        text: `${hostile} tail`,
        paint: { kind: 'solid', color: '#111111' },
        fontSize: 16,
        fontWeight: 700,
        align: 'start',
      } as CompositionLayer;
      drawComposition(fake.context, scene([layer]), {
        direction: 'rtl',
        fontFamily: 'Fictional Sans, sans-serif',
      });
      const texts = fake.calls.filter((c) => c.op === 'fillText');
      expect(texts.map((c) => c.args[0]).join('')).toContain('<img');
      expect(texts[0]).toMatchObject({
        textAlign: 'right',
        direction: 'rtl',
        font: '700 16px Fictional Sans, sans-serif',
      });
      expect(texts[0]?.args[1]).toBe(100);
      // 40 units of height at 16 × 1.25 = 20 per line: at most 2 lines are drawn.
      expect(texts.length).toBeLessThanOrEqual(2);
      expect(fake.ops()).toContain('clip');
    }
    cleanup();
    vi.restoreAllMocks();
    {
      // centers and end-aligns text in LTR
      const fake = fakeContext();
      const base = {
        type: 'text',
        frame: { x: 0, y: 0, width: 100, height: 40 },
        text: 'Hi',
        paint: { kind: 'solid', color: '#111111' },
        fontSize: 10,
      };
      drawComposition(
        fake.context,
        scene([
          { ...base, id: 'c', align: 'center' } as CompositionLayer,
          { ...base, id: 'e', align: 'end' } as CompositionLayer,
        ])
      );
      const texts = fake.calls.filter((c) => c.op === 'fillText');
      expect(texts.map((c) => [c.textAlign, c.args[1]])).toEqual([
        ['center', 50],
        ['right', 100],
      ]);
    }
    cleanup();
    vi.restoreAllMocks();
    {
      // fits and clips images, and skips images that did not load
      const fake = fakeContext();
      const photo = {
        id: 'photo',
        type: 'image',
        frame: { x: 0, y: 0, width: 100, height: 100 },
        src: 'https://media.example.test/a.webp',
        alt: 'A fictional harbor',
        fit: 'contain',
      } as CompositionLayer;
      const missing = {
        ...photo,
        id: 'missing',
        src: 'https://media.example.test/b.webp',
      } as CompositionLayer;
      const report = drawComposition(fake.context, scene([photo, missing]), {
        images: new Map([['https://media.example.test/a.webp', image(200, 100)]]),
      });
      expect(report.drawn).toEqual(['photo']);
      expect(report.skipped).toEqual([{ layerId: 'missing', reason: 'image-unavailable' }]);
      const draw = fake.calls.find((c) => c.op === 'drawImage');
      expect(draw?.args.slice(1)).toEqual([0, 25, 100, 50]);
      expect(fake.ops().indexOf('clip')).toBeLessThan(fake.ops().indexOf('drawImage'));
    }
    cleanup();
    vi.restoreAllMocks();
    {
      // cuts a layer with an alpha mask and never paints the mask source on its own
      const fake = fakeContext();
      const scratch = scratchFactory();
      const layers = [
        rect('shape', { mask: { layerId: 'cutout', mode: 'alpha' } }),
        rect('cutout', { shape: 'ellipse' } as Partial<CompositionLayer>),
      ];
      const report = drawComposition(fake.context, scene(layers), {
        createScratch: scratch.factory,
      });
      expect(report.drawn).toEqual(['shape']);
      expect(report.maskSources).toEqual(['cutout']);
      expect(scratch.made).toHaveLength(2);
      const [content, cutter] = scratch.made;
      expect(cutter?.ops()).toContain('ellipse');
      const cut = content?.calls.find((c) => c.op === 'drawImage');
      expect(cut?.blend).toBe('destination-in');
      expect(cut?.matrix).toEqual([1, 0, 0, 1, 0, 0]);
      // The masked result lands on the main canvas once, at the layer's opacity.
      expect(fake.calls.filter((c) => c.op === 'drawImage')).toHaveLength(1);
      expect(fake.ops()).not.toContain('ellipse');
    }
    cleanup();
    vi.restoreAllMocks();
    {
      // inverts a mask with destination-out
      const scratch = scratchFactory();
      drawComposition(
        fakeContext().context,
        scene([rect('a', { mask: { layerId: 'm', mode: 'alpha', invert: true } }), rect('m')]),
        {
          createScratch: scratch.factory,
        }
      );
      expect(scratch.made[0]?.calls.find((c) => c.op === 'drawImage')?.blend).toBe(
        'destination-out'
      );
    }
    cleanup();
    vi.restoreAllMocks();
    {
      // turns luminance into alpha for a luminance mask
      // One pure-white opaque pixel and one pure-black opaque pixel.
      const pixels = new Uint8ClampedArray([255, 255, 255, 255, 0, 0, 0, 255]);
      const scratch = scratchFactory({ pixels });
      drawComposition(
        fakeContext().context,
        scene([rect('a', { mask: { layerId: 'm', mode: 'luminance' } }), rect('m')]),
        {
          createScratch: scratch.factory,
        }
      );
      const cutter = scratch.made[1];
      expect(cutter?.ops()).toContain('putImageData');
      expect(Array.from(pixels)).toEqual([255, 255, 255, 255, 255, 255, 255, 0]);
    }
    cleanup();
    vi.restoreAllMocks();
    {
      // falls back to the alpha channel when the mask surface is tainted
      const scratch = scratchFactory({ taint: true });
      const report = drawComposition(
        fakeContext().context,
        scene([rect('a', { mask: { layerId: 'm', mode: 'luminance' } }), rect('m')]),
        {
          createScratch: scratch.factory,
        }
      );
      expect(report.drawn).toEqual(['a']);
      expect(report.warnings).toEqual([{ layerId: 'a', code: 'luminance-as-alpha' }]);
    }
    cleanup();
    vi.restoreAllMocks();
    {
      // skips masked layers when no scratch surface is available
      const report = drawComposition(
        fakeContext().context,
        scene([rect('a', { mask: { layerId: 'm', mode: 'alpha' } }), rect('m')])
      );
      expect(report.skipped).toEqual([{ layerId: 'a', reason: 'mask-unsupported' }]);
      expect(report.drawn).toEqual([]);
    }
    cleanup();
    vi.restoreAllMocks();
    {
      // reports a mask whose source paints nothing
      const scratch = scratchFactory();
      const layers = [
        rect('a', { mask: { layerId: 'm', mode: 'alpha' } }),
        {
          id: 'm',
          type: 'image',
          frame: { x: 0, y: 0, width: 10, height: 10 },
          src: 'https://media.example.test/m.webp',
          alt: '',
        } as CompositionLayer,
      ];
      const report = drawComposition(fakeContext().context, scene(layers), {
        createScratch: scratch.factory,
      });
      expect(report.skipped).toEqual([{ layerId: 'a', reason: 'mask-unavailable' }]);
    }
    cleanup();
    vi.restoreAllMocks();
    {
      // follows a chain of masks
      const scratch = scratchFactory();
      const layers = [
        rect('a', { mask: { layerId: 'b', mode: 'alpha' } }),
        rect('b', { mask: { layerId: 'c', mode: 'alpha' } }),
        rect('c'),
      ];
      const report = drawComposition(fakeContext().context, scene(layers), {
        createScratch: scratch.factory,
      });
      expect(report.drawn).toEqual(['a']);
      expect(report.maskSources).toEqual(['b', 'c']);
      expect(scratch.made).toHaveLength(4);
    }
  });
});

describe('loadCompositionImages', () => {
  const withImages = (...srcs: string[]) =>
    scene(
      srcs.map(
        (src, i) =>
          ({
            id: `img-${i}`,
            type: 'image',
            frame: { x: 0, y: 0, width: 10, height: 10 },
            src,
            alt: '',
          }) as CompositionLayer
      )
    );
  it('checks every source against the URL policy before any request, and 3 related cases', async () => {
    // checks every source against the URL policy before any request
    await (async () => {
      const load = vi.fn(async () => image());
      const result = await loadCompositionImages(
        withImages(
          'https://media.example.test/ok.webp',
          'javascript:alert(1)',
          'http://media.example.test/plain.webp',
          'data:image/png;base64,iVBORw0KGgo=',
          'https://media.example.test/ok.webp'
        ),
        { load }
      );
      expect(load).toHaveBeenCalledTimes(1);
      expect(load).toHaveBeenCalledWith('https://media.example.test/ok.webp', undefined);
      expect([...result.images.keys()]).toEqual(['https://media.example.test/ok.webp']);
      expect(result.refused).toEqual([
        'data:image/png;base64,iVBORw0KGgo=',
        'http://media.example.test/plain.webp',
        'javascript:alert(1)',
      ]);
    })();
    cleanup();
    vi.restoreAllMocks();
    // lets developer data use http and bounded data images
    await (async () => {
      const load = vi.fn(async () => image());
      const result = await loadCompositionImages(
        withImages('http://media.example.test/plain.webp', 'data:image/png;base64,iVBORw0KGgo='),
        { load, trust: 'developer' }
      );
      expect(result.refused).toEqual([]);
      expect(load).toHaveBeenCalledTimes(2);
    })();
    cleanup();
    vi.restoreAllMocks();
    // reports failures, empty images and timeouts without rejecting
    await (async () => {
      const result = await loadCompositionImages(
        withImages(
          'https://media.example.test/a.webp',
          'https://media.example.test/b.webp',
          'https://media.example.test/c.webp'
        ),
        {
          timeoutMs: 20,
          load: async (src) => {
            if (src.endsWith('a.webp')) throw new Error('404');
            if (src.endsWith('b.webp')) return { ...image(), width: 0 };
            return new Promise(() => {});
          },
        }
      );
      expect(result.failed).toEqual([
        'https://media.example.test/a.webp',
        'https://media.example.test/b.webp',
        'https://media.example.test/c.webp',
      ]);
      expect(result.images.size).toBe(0);
    })();
    cleanup();
    vi.restoreAllMocks();
    // reuses cached images and loads nothing after an abort
    await (async () => {
      const load = vi.fn(async () => image());
      const cached = image(1, 1);
      const controller = new AbortController();
      controller.abort();
      const result = await loadCompositionImages(
        withImages('https://media.example.test/a.webp', 'https://media.example.test/b.webp'),
        {
          load,
          signal: controller.signal,
          cache: new Map([['https://media.example.test/a.webp', cached]]),
        }
      );
      expect(load).not.toHaveBeenCalled();
      expect(result.images.get('https://media.example.test/a.webp')).toBe(cached);
      expect(result.failed).toEqual(['https://media.example.test/b.webp']);
    })();
  });
});

describe('renderComposition', () => {
  const canvasWith = (context: CompositionContext2D | null) => ({
    width: 300,
    height: 150,
    getContext: vi.fn(() => context),
  });
  it('rejects invalid or unsafe data before touching the canvas or the network, and 2 related cases', async () => {
    // rejects invalid or unsafe data before touching the canvas or the network
    await (async () => {
      const fake = fakeContext();
      const canvas = canvasWith(fake.context);
      const load = vi.fn(async () => image());
      const result = await renderComposition(
        canvas,
        scene([
          {
            id: 'evil',
            type: 'image',
            frame: { x: 0, y: 0, width: 10, height: 10 },
            src: 'javascript:alert(1)',
            alt: '',
          } as CompositionLayer,
        ]),
        { loadImage: load }
      );
      expect(result).toMatchObject({ ok: false, reason: 'invalid' });
      if (!result.ok && result.reason === 'invalid')
        expect(result.errors[0]?.code).toBe('unsafe-source');
      expect(load).not.toHaveBeenCalled();
      expect(canvas.getContext).not.toHaveBeenCalled();
      expect(canvas.width).toBe(300);

      const notAComposition = await renderComposition(canvas, {
        version: 1,
        width: 10,
        height: 10,
        layers: [],
        extra: '<script>',
      });
      expect(notAComposition).toMatchObject({ ok: false, reason: 'invalid' });
      expect(fake.calls).toEqual([]);
    })();
    cleanup();
    vi.restoreAllMocks();
    // sizes the canvas for the pixel ratio, loads images and draws
    await (async () => {
      const fake = fakeContext();
      const canvas = canvasWith(fake.context);
      const cache = new Map<string, CompositionImage>();
      const load = vi.fn(async () => image());
      const input = scene([
        rect('bg'),
        {
          id: 'pic',
          type: 'image',
          frame: { x: 0, y: 0, width: 50, height: 50 },
          src: 'https://media.example.test/p.webp',
          alt: 'Fictional park',
        } as CompositionLayer,
      ]);
      const result = await renderComposition(canvas, input, {
        pixelRatio: 2,
        loadImage: load,
        imageCache: cache,
        createScratch: scratchFactory().factory,
      });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(canvas.width).toBe(800);
      expect(canvas.height).toBe(600);
      expect(result.scale).toBe(2);
      expect(result.report.drawn).toEqual(['bg', 'pic']);
      expect(cache.has('https://media.example.test/p.webp')).toBe(true);

      await renderComposition(canvas, input, { pixelRatio: 2, loadImage: load, imageCache: cache });
      expect(load).toHaveBeenCalledTimes(1);
    })();
    cleanup();
    vi.restoreAllMocks();
    // reports a missing 2D context and an aborted render
    await (async () => {
      expect(await renderComposition(canvasWith(null), scene([rect('a')]))).toEqual({
        ok: false,
        reason: 'unsupported',
      });
      const controller = new AbortController();
      controller.abort();
      const fake = fakeContext();
      expect(
        await renderComposition(canvasWith(fake.context), scene([rect('a')]), {
          signal: controller.signal,
        })
      ).toEqual({ ok: false, reason: 'aborted' });
      expect(fake.calls).toEqual([]);
    })();
  });
});

describe('viewport', () => {
  const size = { width: 400, height: 300 };
  it('clamps zoom and keeps the view inside the composition, and 2 related cases', () => {
    // clamps zoom and keeps the view inside the composition
    expect(clampViewport(size, { x: -50, y: 999, zoom: 2 })).toEqual({ x: 0, y: 150, zoom: 2 });
    expect(clampViewport(size, { x: 10, y: 10, zoom: 0.1 })).toEqual({ x: 0, y: 0, zoom: 1 });
    expect(clampViewport(size, { x: Number.NaN, y: 0, zoom: Number.POSITIVE_INFINITY })).toEqual({
      x: 0,
      y: 0,
      zoom: 1,
    });
    expect(clampViewport(size, { x: 0, y: 0, zoom: 100 }).zoom).toBe(8);
    cleanup();
    vi.restoreAllMocks();
    {
      // zooms around the view center and pans by a quarter of the view
      const zoomed = zoomViewport(size, { x: 0, y: 0, zoom: 1 }, 2);
      expect(zoomed).toEqual({ x: 100, y: 75, zoom: 2 });
      expect(applyViewportAction(size, zoomed, 'pan-right')).toEqual({ x: 150, y: 75, zoom: 2 });
      expect(applyViewportAction(size, zoomed, 'pan-up')).toEqual({ x: 100, y: 37.5, zoom: 2 });
      expect(applyViewportAction(size, zoomed, 'reset')).toEqual({ x: 0, y: 0, zoom: 1 });
      expect(applyViewportAction(size, { x: 0, y: 0, zoom: 1 }, 'pan-left')).toEqual({
        x: 0,
        y: 0,
        zoom: 1,
      });
      expect(applyViewportAction(size, { x: 0, y: 0, zoom: 1 }, 'zoom-in').zoom).toBe(1.25);
    }
    cleanup();
    vi.restoreAllMocks();
    // maps keys to actions and leaves modified keys alone
    expect(viewportKeyAction({ key: '+' })).toBe('zoom-in');
    expect(viewportKeyAction({ key: '=' })).toBe('zoom-in');
    expect(viewportKeyAction({ key: '-' })).toBe('zoom-out');
    expect(viewportKeyAction({ key: '0' })).toBe('reset');
    expect(viewportKeyAction({ key: 'ArrowLeft' })).toBe('pan-left');
    expect(viewportKeyAction({ key: 'ArrowDown' })).toBe('pan-down');
    expect(viewportKeyAction({ key: '+', ctrlKey: true })).toBeNull();
    expect(viewportKeyAction({ key: 'Tab' })).toBeNull();
  });
});

describe('describeComposition', () => {
  it('lists text and image alt in paint order, without mask sources or decorative images', () => {
    const items = describeComposition(
      scene([
        {
          id: 'pic',
          type: 'image',
          frame: { x: 0, y: 0, width: 10, height: 10 },
          src: 'https://media.example.test/p.webp',
          alt: 'Fictional pier',
          mask: { layerId: 'mask-text', mode: 'alpha' },
        } as CompositionLayer,
        {
          id: 'deco',
          type: 'image',
          frame: { x: 0, y: 0, width: 10, height: 10 },
          src: 'https://media.example.test/d.webp',
          alt: '',
        } as CompositionLayer,
        {
          id: 'mask-text',
          type: 'text',
          frame: { x: 0, y: 0, width: 10, height: 10 },
          text: 'MASK',
          paint: { kind: 'solid', color: '#ffffff' },
          fontSize: 10,
        } as CompositionLayer,
        {
          id: 'title',
          type: 'text',
          frame: { x: 0, y: 0, width: 10, height: 10 },
          text: 'Harbor days',
          paint: { kind: 'solid', color: '#000000' },
          fontSize: 10,
        } as CompositionLayer,
      ])
    );
    expect(items).toEqual([
      { layerId: 'pic', kind: 'image', text: 'Fictional pier' },
      { layerId: 'title', kind: 'text', text: 'Harbor days' },
    ]);
  });
});

describe('CompositionCanvas', () => {
  afterEach(() => vi.restoreAllMocks());

  const demo = scene([
    rect('bg', { frame: { x: 0, y: 0, width: 400, height: 300 } }),
    {
      id: 'title',
      type: 'text',
      frame: { x: 20, y: 20, width: 300, height: 40 },
      text: 'Quarterly harbor report',
      paint: { kind: 'solid', color: '#ffffff' },
      fontSize: 24,
    } as CompositionLayer,
  ]);
  it('shows a loading status, then a note instead of a canvas for invalid data, and 3 related cases', async () => {
    // shows a loading status, then a note instead of a canvas for invalid data
    await (async () => {
      render(CompositionCanvas, {
        props: {
          composition: { version: 2 },
          labels: { invalid: 'Datos no válidos.', loading: 'Cargando…' },
        },
      });
      expect(screen.getByRole('status').textContent).toBe('Cargando…');
      expect((await screen.findByRole('note')).textContent).toBe('Datos no válidos.');
      expect(document.querySelector('canvas')).toBeNull();
    })();
    cleanup();
    vi.restoreAllMocks();
    // names the image, describes its text and draws it
    await (async () => {
      const fake = fakeContext();
      vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
        fake.context as unknown as CanvasRenderingContext2D
      );
      const onrender = vi.fn();
      render(CompositionCanvas, {
        props: { composition: demo, label: 'Harbor poster', pixelRatio: 1, onrender },
      });
      const img = await screen.findByRole('img', { name: 'Harbor poster' });
      const describedBy = img.getAttribute('aria-describedby')?.split(' ') ?? [];
      const description = describedBy
        .map((id) => document.getElementById(id)?.textContent ?? '')
        .join(' ');
      expect(description).toContain('Quarterly harbor report');
      expect(description).toContain('arrow keys pan');
      await waitFor(() => expect(onrender).toHaveBeenCalled());
      expect(onrender.mock.calls.at(-1)?.[0]).toMatchObject({
        ok: true,
        report: { drawn: ['bg', 'title'] },
      });
      expect(
        fake.calls.some((c) => c.op === 'fillText' && c.args[0] === 'Quarterly harbor report')
      ).toBe(true);
    })();
    cleanup();
    vi.restoreAllMocks();
    // zooms, pans and resets from buttons and keys, announcing the zoom
    await (async () => {
      vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
        fakeContext().context as unknown as CanvasRenderingContext2D
      );
      const onrender = vi.fn();
      render(CompositionCanvas, { props: { composition: demo, pixelRatio: 1, onrender } });
      const zoomIn = await screen.findByRole('button', { name: 'Zoom in' });
      const zoomOut = screen.getByRole('button', { name: 'Zoom out' });
      const panRight = screen.getByRole('button', { name: 'Pan right' });
      expect(zoomOut.getAttribute('aria-disabled')).toBe('true');
      expect(panRight.getAttribute('aria-disabled')).toBe('true');

      await fireEvent.click(zoomIn);
      expect(screen.getByRole('status').textContent).toBe('Zoom 125%');
      expect(zoomOut.getAttribute('aria-disabled')).toBe('false');
      expect(panRight.getAttribute('aria-disabled')).toBe('false');

      await fireEvent.keyDown(zoomIn, { key: '+' });
      expect(screen.getByRole('status').textContent).toBe('Zoom 156%');
      await fireEvent.keyDown(zoomIn, { key: 'ArrowRight' });
      await waitFor(() => {
        const viewport = onrender.mock.calls.at(-1)?.[0];
        expect(viewport?.ok).toBe(true);
      });
      await fireEvent.keyDown(zoomIn, { key: '0' });
      expect(screen.getByRole('status').textContent).toBe('Zoom 100%');
      expect(panRight.getAttribute('aria-disabled')).toBe('true');
      // An unavailable button keeps focus and does nothing.
      panRight.focus();
      await fireEvent.click(panRight);
      expect(document.activeElement).toBe(panRight);
      expect(screen.getByRole('status').textContent).toBe('Zoom 100%');
    })();
    cleanup();
    vi.restoreAllMocks();
    // shows the unsupported note when the browser has no 2D canvas
    await (async () => {
      vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
      render(CompositionCanvas, {
        props: { composition: demo, labels: { unsupported: 'Sin lienzo.' } },
      });
      await waitFor(() => expect(screen.getByRole('note').textContent).toBe('Sin lienzo.'));
    })();
  });
});
