import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fireEvent, render } from '@testing-library/svelte';
import { flushSync, tick } from 'svelte';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import {
  type Annotation,
  type EditAction,
  type ImageEdit,
  ImageEditor,
} from '../src/image-editor/index.ts';
import {
  applyColorMatrix,
  applyEditAction,
  boxBlur,
  createEditHistory,
  createImageEdit,
  cropToAspectRatio,
  cssFilter,
  editHistoryReducer,
  filterColorMatrix,
  IMAGE_EDIT_LIMITS,
  isNeutralEdit,
  NEUTRAL_FILTERS,
  outputSize,
  rotateRect,
  validateImageEdit,
} from '../src/image-editor/model.ts';
import {
  drawImageEdit,
  type EditableImage,
  type EditDrawContext,
  exportImageEdit,
  haloFor,
  loadEditableImage,
  supportsCanvasFilter,
} from '../src/image-editor/render.ts';

// ── a 2D context double that tracks the transform like a canvas does ───────

type Matrix = [number, number, number, number, number, number]; // a b c d e f

function multiply(m: Matrix, n: Matrix): Matrix {
  return [
    m[0] * n[0] + m[2] * n[1],
    m[1] * n[0] + m[3] * n[1],
    m[0] * n[2] + m[2] * n[3],
    m[1] * n[2] + m[3] * n[3],
    m[0] * n[4] + m[2] * n[5] + m[4],
    m[1] * n[4] + m[3] * n[5] + m[5],
  ];
}

function invert(m: Matrix): Matrix {
  const det = m[0] * m[3] - m[1] * m[2];
  return [
    m[3] / det,
    -m[1] / det,
    -m[2] / det,
    m[0] / det,
    (m[2] * m[5] - m[3] * m[4]) / det,
    (m[1] * m[4] - m[0] * m[5]) / det,
  ];
}

class RecordingContext {
  matrix: Matrix = [1, 0, 0, 1, 0, 0];
  stack: Matrix[] = [];
  calls: { name: string; args: unknown[]; filter?: string; matrix: Matrix }[] = [];
  lineWidth = 1;
  lineJoin: CanvasLineJoin = 'miter';
  lineCap: CanvasLineCap = 'butt';
  strokeStyle: string | CanvasGradient | CanvasPattern = '#000';
  fillStyle: string | CanvasGradient | CanvasPattern = '#000';
  font = '';
  textBaseline: CanvasTextBaseline = 'alphabetic';
  textAlign: CanvasTextAlign = 'start';
  direction: CanvasDirection = 'inherit';
  filter = 'none';
  pixels: ImageData | null = null;
  getImageDataThrows = false;

  constructor(supportsFilter = true) {
    if (!supportsFilter) {
      // An engine that ignores ctx.filter keeps reporting 'none'.
      Object.defineProperty(this, 'filter', { get: () => 'none', set: () => {} });
    }
  }
  private log(name: string, args: unknown[]) {
    this.calls.push({ name, args, filter: this.filter, matrix: [...this.matrix] as Matrix });
  }
  save() {
    this.stack.push([...this.matrix] as Matrix);
  }
  restore() {
    this.matrix = this.stack.pop() ?? [1, 0, 0, 1, 0, 0];
  }
  setTransform(a: number, b: number, c: number, d: number, e: number, f: number) {
    this.matrix = [a, b, c, d, e, f];
  }
  translate(x: number, y: number) {
    this.matrix = multiply(this.matrix, [1, 0, 0, 1, x, y]);
  }
  scale(x: number, y: number) {
    this.matrix = multiply(this.matrix, [x, 0, 0, y, 0, 0]);
  }
  rotate(angle: number) {
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    this.matrix = multiply(this.matrix, [c, s, -s, c, 0, 0]);
  }
  drawImage(...args: unknown[]) {
    this.log('drawImage', args);
  }
  clearRect(...args: unknown[]) {
    this.log('clearRect', args);
  }
  beginPath() {
    this.log('beginPath', []);
  }
  moveTo(...args: unknown[]) {
    this.log('moveTo', args);
  }
  lineTo(...args: unknown[]) {
    this.log('lineTo', args);
  }
  ellipse(...args: unknown[]) {
    this.log('ellipse', args);
  }
  rect(...args: unknown[]) {
    this.log('rect', args);
  }
  stroke() {
    this.log('stroke', [this.strokeStyle, this.lineWidth]);
  }
  fillText(...args: unknown[]) {
    this.log('fillText', [...args, this.fillStyle, this.font]);
  }
  strokeText(...args: unknown[]) {
    this.log('strokeText', [...args, this.strokeStyle]);
  }
  getImageData(_x: number, _y: number, w: number, h: number): ImageData {
    if (this.getImageDataThrows) throw new DOMException('tainted', 'SecurityError');
    this.pixels ??= {
      data: new Uint8ClampedArray(w * h * 4).fill(100),
      width: w,
      height: h,
    } as ImageData;
    return this.pixels;
  }
  putImageData(data: ImageData) {
    this.log('putImageData', [data]);
  }
}

const asContext = (ctx: RecordingContext) => ctx as unknown as EditDrawContext;
const SOURCE: EditableImage = { source: {} as CanvasImageSource, width: 400, height: 200 };

/** The source pixel shown at an output pixel, from the transform at drawImage time. */
function sourcePixelAt(edit: ImageEdit, out: { x: number; y: number }, image = SOURCE) {
  const ctx = new RecordingContext();
  drawImageEdit(asContext(ctx), image, edit, { annotations: false });
  const draw = ctx.calls.find((c) => c.name === 'drawImage');
  if (!draw) throw new Error('no drawImage');
  const inv = invert(draw.matrix);
  const x = inv[0] * out.x + inv[2] * out.y + inv[4];
  const y = inv[1] * out.x + inv[3] * out.y + inv[5];
  // drawImage places the source at (-w/2, -h/2).
  return { x: x + image.width / 2, y: y + image.height / 2 };
}

const near = (a: { x: number; y: number }, b: { x: number; y: number }) => {
  expect(a.x).toBeCloseTo(b.x, 6);
  expect(a.y).toBeCloseTo(b.y, 6);
};

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

// ── model ────────────────────────────────────────────────────────────────

describe('edit model', () => {
  it('starts neutral, and every action returns a new edit without mutating the old one', () => {
    const edit = createImageEdit();
    expect(isNeutralEdit(edit)).toBe(true);
    const frozen = structuredClone(edit);
    const next = applyEditAction(edit, { type: 'rotate', turns: 1 });
    expect(edit).toEqual(frozen);
    expect(next).not.toBe(edit);
    expect(isNeutralEdit(next)).toBe(false);
  });

  it('composes rotations and flips the way the shown image turns', () => {
    let edit = createImageEdit();
    for (let i = 0; i < 4; i++) edit = applyEditAction(edit, { type: 'rotate', turns: 1 });
    expect(edit.rotate).toBe(0);
    // Rotating a horizontally flipped image equals a vertical flip after the rotation.
    edit = applyEditAction(createImageEdit(), { type: 'flip', axis: 'x' });
    edit = applyEditAction(edit, { type: 'rotate', turns: 1 });
    expect([edit.rotate, edit.flipX, edit.flipY]).toEqual([90, false, true]);
    edit = applyEditAction(edit, { type: 'rotate', turns: -1 });
    expect([edit.rotate, edit.flipX, edit.flipY]).toEqual([0, true, false]);
  });

  it('keeps the same source region under the crop when the image is rotated or flipped', () => {
    // A crop around a known area, then every orientation action: the source pixel
    // at each corner of the output must stay the same (corners permute, not move).
    let edit = applyEditAction(createImageEdit(), {
      type: 'crop',
      rect: { x: 0.1, y: 0.2, width: 0.3, height: 0.5 },
    });
    const corners = (e: ImageEdit) => {
      const size = outputSize(e, SOURCE);
      return [
        sourcePixelAt(e, { x: 0, y: 0 }),
        sourcePixelAt(e, { x: size.width, y: 0 }),
        sourcePixelAt(e, { x: 0, y: size.height }),
        sourcePixelAt(e, { x: size.width, y: size.height }),
      ]
        .map((p) => `${Math.round(p.x)},${Math.round(p.y)}`)
        .sort();
    };
    const region = corners(edit);
    expect(region).toEqual(['160,40', '160,140', '40,40', '40,140'].sort());
    const actions: EditAction[] = [
      { type: 'rotate', turns: 1 },
      { type: 'flip', axis: 'x' },
      { type: 'rotate', turns: 1 },
      { type: 'flip', axis: 'y' },
      { type: 'rotate', turns: -1 },
      { type: 'rotate', turns: 1 },
      { type: 'rotate', turns: 1 },
    ];
    for (const action of actions) {
      edit = applyEditAction(edit, action);
      expect(corners(edit), JSON.stringify(action)).toEqual(region);
    }
  });

  it('rotates the shown image clockwise: the old top-start corner goes to the top-end', () => {
    const turned = applyEditAction(createImageEdit(), { type: 'rotate', turns: 1 });
    const size = outputSize(turned, SOURCE);
    expect(size).toEqual({ width: 200, height: 400 });
    near(sourcePixelAt(turned, { x: size.width, y: 0 }), { x: 0, y: 0 });
    const flipped = applyEditAction(createImageEdit(), { type: 'flip', axis: 'x' });
    near(sourcePixelAt(flipped, { x: 0, y: 0 }), { x: 400, y: 0 });
  });

  it('carries annotations with rotations and flips', () => {
    const rect: Annotation = {
      id: 'box',
      type: 'rect',
      color: '#e11d48',
      strokeWidth: 0.01,
      frame: { x: 0.1, y: 0.2, width: 0.3, height: 0.4 },
    };
    let edit = applyEditAction(createImageEdit(), { type: 'add-annotation', annotation: rect });
    edit = applyEditAction(edit, { type: 'rotate', turns: 1 });
    const turned = edit.annotations[0];
    expect(turned?.type === 'rect' && turned.frame).toEqual(rotateRect(rect.frame, 1));
    edit = applyEditAction(edit, { type: 'rotate', turns: -1 });
    const back = edit.annotations[0];
    expect(back?.type === 'rect' && back.frame.x).toBeCloseTo(0.1);
  });

  it('computes the output size from crop and resize, and caps it', () => {
    const cropped = applyEditAction(createImageEdit(), {
      type: 'crop',
      rect: { x: 0.25, y: 0, width: 0.5, height: 0.5 },
    });
    expect(outputSize(cropped, SOURCE)).toEqual({ width: 200, height: 100 });
    const resized = applyEditAction(cropped, { type: 'resize', size: { width: 50, height: 25 } });
    expect(outputSize(resized, SOURCE)).toEqual({ width: 50, height: 25 });
    const huge = applyEditAction(cropped, { type: 'resize', size: { width: 8192, height: 8192 } });
    const capped = outputSize(huge, SOURCE);
    expect(capped.width * capped.height).toBeLessThanOrEqual(IMAGE_EDIT_LIMITS.maxPixels);
    expect(capped.width).toBe(capped.height);
    // A full-image crop is the same as no crop.
    expect(
      applyEditAction(cropped, { type: 'crop', rect: { x: 0, y: 0, width: 1, height: 1 } }).crop
    ).toBeUndefined();
  });

  it('clamps filters, crops, moves and annotation edits into their ranges', () => {
    let edit = applyEditAction(createImageEdit(), {
      type: 'filter',
      name: 'brightness',
      value: 999,
    });
    expect(edit.filters.brightness).toBe(200);
    edit = applyEditAction(edit, { type: 'filter', name: 'blur', value: Number.NaN });
    expect(edit.filters.blur).toBe(0);
    edit = applyEditAction(edit, { type: 'crop', rect: { x: 0.9, y: -1, width: 0.5, height: 0 } });
    expect(edit.crop).toEqual({ x: 0.5, y: 0, width: 0.5, height: IMAGE_EDIT_LIMITS.minCrop });

    const text: Annotation = {
      id: 'note',
      type: 'text',
      color: '#111827',
      strokeWidth: 0.004,
      at: { x: 0.95, y: 0.5 },
      text: 'Pier 3',
      fontSize: 0.08,
    };
    edit = applyEditAction(edit, { type: 'add-annotation', annotation: text });
    edit = applyEditAction(edit, { type: 'move-annotation', id: 'note', dx: 0.5, dy: 0 });
    expect(edit.annotations[0]?.type === 'text' && edit.annotations[0].at.x).toBe(1);
    edit = applyEditAction(edit, {
      type: 'update-annotation',
      id: 'note',
      patch: { color: 'red', text: 'bad\u0007', fontSize: 9 },
    });
    const after = edit.annotations[0];
    expect(after?.color).toBe('#111827');
    expect(after?.type === 'text' && [after.text, after.fontSize]).toEqual(['Pier 3', 0.5]);
    // A duplicate id and an invalid annotation are ignored.
    expect(applyEditAction(edit, { type: 'add-annotation', annotation: text })).toBe(edit);
    expect(
      applyEditAction(edit, {
        type: 'add-annotation',
        annotation: { ...text, id: 'other', color: 'javascript:1' } as Annotation,
      })
    ).toBe(edit);
    expect(applyEditAction(edit, { type: 'remove-annotation', id: 'note' }).annotations).toEqual(
      []
    );
    expect(isNeutralEdit(applyEditAction(edit, { type: 'reset' }))).toBe(true);
  });

  it('caps the number of annotations', () => {
    let edit = createImageEdit();
    for (let i = 0; i < IMAGE_EDIT_LIMITS.maxAnnotations + 5; i++) {
      edit = applyEditAction(edit, {
        type: 'add-annotation',
        annotation: {
          id: `a${i}`,
          type: 'arrow',
          color: '#2563eb',
          strokeWidth: 0.01,
          from: { x: 0, y: 0 },
          to: { x: 1, y: 1 },
        },
      });
    }
    expect(edit.annotations).toHaveLength(IMAGE_EDIT_LIMITS.maxAnnotations);
  });
});

describe('edit history', () => {
  it('undoes and redoes, merges slider drags, and ignores no-op actions', () => {
    let history = createEditHistory();
    const apply = (action: EditAction) => {
      history = editHistoryReducer(history, { type: 'apply', action });
    };
    apply({ type: 'rotate', turns: 1 });
    apply({ type: 'filter', name: 'contrast', value: 110 });
    apply({ type: 'filter', name: 'contrast', value: 120 });
    apply({ type: 'filter', name: 'contrast', value: 130 });
    expect(history.past).toHaveLength(2);
    const before = history;
    apply({ type: 'filter', name: 'contrast', value: 130 });
    expect(history).toBe(before);

    history = editHistoryReducer(history, { type: 'undo' });
    expect(history.present.filters.contrast).toBe(100);
    history = editHistoryReducer(history, { type: 'undo' });
    expect(history.present.rotate).toBe(0);
    expect(editHistoryReducer(history, { type: 'undo' })).toBe(history);
    history = editHistoryReducer(history, { type: 'redo' });
    expect(history.present.rotate).toBe(90);
    // A new action clears the redo stack.
    apply({ type: 'flip', axis: 'y' });
    expect(history.future).toHaveLength(0);
  });

  it('keeps at most the history limit', () => {
    let history = createEditHistory();
    for (let i = 0; i < IMAGE_EDIT_LIMITS.maxHistory + 20; i++) {
      history = editHistoryReducer(history, {
        type: 'apply',
        action: { type: 'flip', axis: i % 2 === 0 ? 'x' : 'y' },
      });
    }
    expect(history.past).toHaveLength(IMAGE_EDIT_LIMITS.maxHistory);
  });
});

describe('validateImageEdit (untrusted edit data)', () => {
  const full = {
    version: 1,
    rotate: 270,
    flipX: true,
    flipY: false,
    crop: { x: 0.1, y: 0.1, width: 0.5, height: 0.5 },
    resize: { width: 640, height: 480 },
    filters: { brightness: 110, blur: 0.002 },
    annotations: [
      {
        id: 'r',
        type: 'rect',
        color: '#16a34a',
        strokeWidth: 0.004,
        frame: { x: 0, y: 0, width: 0.2, height: 0.2 },
      },
      {
        id: 'a',
        type: 'arrow',
        color: '#2563eb',
        strokeWidth: 0.01,
        from: { x: 0, y: 0 },
        to: { x: 1, y: 1 },
      },
      {
        id: 't',
        type: 'text',
        color: '#ffffff',
        strokeWidth: 0.004,
        at: { x: 0.5, y: 0.5 },
        text: 'Dock B — بوابة',
        fontSize: 0.1,
      },
    ],
  };

  it('accepts a complete edit, from an object or a JSON string, filling neutral filters', () => {
    for (const input of [full, JSON.stringify(full)]) {
      const result = validateImageEdit(input);
      expect(result.ok).toBe(true);
      if (!result.ok) continue;
      expect(result.edit.filters).toEqual({ ...NEUTRAL_FILTERS, brightness: 110, blur: 0.002 });
      expect(result.edit.annotations).toHaveLength(3);
    }
  });

  it('refuses hostile and malformed input as a whole, with a path for each problem', () => {
    const codes = (input: unknown) => {
      const result = validateImageEdit(input);
      expect(result.ok, JSON.stringify(input)?.slice(0, 80)).toBe(false);
      return result.ok ? [] : result.errors.map((e) => `${e.path} ${e.code}`);
    };
    expect(codes(null)).toEqual(['$ invalid-input']);
    expect(codes('{not json')).toEqual(['$ invalid-input']);
    expect(codes({ ...full, version: 2 })).toContain('$.version invalid-value');
    expect(codes({ ...full, rotate: 45 })).toContain('$.rotate invalid-value');
    expect(codes({ ...full, extra: 1 })).toContain('$.extra unknown-field');
    expect(codes(JSON.parse('{"version":1,"__proto__":{"polluted":true}}'))).toContain(
      '$.__proto__ unknown-field'
    );
    expect(codes({ ...full, crop: { x: 0.8, y: 0, width: 0.5, height: 0.5 } })).toContain(
      '$.crop invalid-value'
    );
    expect(codes({ ...full, resize: { width: 10.5, height: 10 } })).toContain(
      '$.resize invalid-value'
    );
    expect(codes({ ...full, filters: { brightness: Number.POSITIVE_INFINITY } })).toContain(
      '$.filters.brightness invalid-value'
    );
    const annotation = (patch: Record<string, unknown>) => ({
      ...full,
      annotations: [{ ...full.annotations[2], ...patch }],
    });
    expect(codes(annotation({ color: 'url(javascript:alert(1))' }))).toContain(
      '$.annotations[0].color invalid-value'
    );
    expect(codes(annotation({ text: 'line\nbreak' }))).toContain(
      '$.annotations[0].text invalid-value'
    );
    expect(codes(annotation({ text: 'x'.repeat(281) }))).toContain(
      '$.annotations[0].text invalid-value'
    );
    expect(codes(annotation({ type: 'script' }))).toContain('$.annotations[0].type invalid-value');
    expect(codes(annotation({ id: '<img>' }))).toContain('$.annotations[0].id invalid-value');
    expect(codes({ ...full, annotations: [full.annotations[0], full.annotations[0]] })).toContain(
      '$.annotations[1].id duplicate-id'
    );
    expect(
      codes({ ...full, annotations: Array.from({ length: 51 }, () => full.annotations[0]) })
    ).toContain('$.annotations limit-exceeded');
    expect(codes({ ...full, padding: 'x'.repeat(70_000) })).toEqual(['$ limit-exceeded']);
  });

  it('does not throw on cyclic input', () => {
    const cyclic: Record<string, unknown> = { version: 1 };
    cyclic.self = cyclic;
    expect(validateImageEdit(cyclic)).toEqual({
      ok: false,
      errors: [{ path: '$', code: 'invalid-input', message: 'Not serializable.' }],
    });
  });
});

describe('filters', () => {
  it('builds a CSS filter only from validated numbers', () => {
    expect(cssFilter(NEUTRAL_FILTERS, 500)).toBe('none');
    expect(
      cssFilter(
        { ...NEUTRAL_FILTERS, brightness: 120, hueRotate: -30, blur: 0.01, sepia: 999 },
        400
      )
    ).toBe('brightness(120%) sepia(100%) hue-rotate(-30deg) blur(4px)');
  });

  it('matches the CSS filter definitions in the pixel fallback', () => {
    const run = (filters: Partial<typeof NEUTRAL_FILTERS>, rgb: [number, number, number]) => {
      const data = new Uint8ClampedArray([...rgb, 255]);
      applyColorMatrix(data, filterColorMatrix({ ...NEUTRAL_FILTERS, ...filters }));
      return [...data];
    };
    expect(run({}, [10, 120, 250])).toEqual([10, 120, 250, 255]);
    expect(run({ brightness: 50 }, [100, 200, 40])).toEqual([50, 100, 20, 255]);
    // contrast(0) makes every channel mid-gray; alpha is untouched.
    expect(run({ contrast: 0 }, [0, 255, 30])).toEqual([128, 128, 128, 255]);
    const gray = run({ grayscale: 100 }, [200, 50, 10]);
    expect(new Set(gray.slice(0, 3)).size).toBe(1);
    expect(gray[0]).toBe(Math.round(0.2126 * 200 + 0.7152 * 50 + 0.0722 * 10));
    // Values clamp to 0–255.
    expect(run({ brightness: 200 }, [200, 200, 200]).slice(0, 3)).toEqual([255, 255, 255]);
  });

  it('blurs like a Gaussian: flat areas stay flat and energy is kept', () => {
    const width = 21;
    const height = 21;
    const flat = new Uint8ClampedArray(width * height * 4).fill(90);
    boxBlur(flat, width, height, 3);
    expect(new Set(flat).size).toBe(1);
    const dot = new Uint8ClampedArray(width * height * 4);
    dot.set([255, 255, 255, 255], (10 * width + 10) * 4);
    boxBlur(dot, width, height, 2);
    const center = dot[(10 * width + 10) * 4] as number;
    expect(center).toBeLessThan(255);
    expect(center).toBeGreaterThan(0);
    expect(dot[(10 * width + 13) * 4]).toBeGreaterThan(0);
    expect(dot[0]).toBe(0);
  });
});

// ── render and export ────────────────────────────────────────────────────

describe('loadEditableImage', () => {
  const image = { source: {} as CanvasImageSource, width: 10, height: 10 };

  it('never requests a refused source', async () => {
    const loader = vi.fn(async () => image);
    for (const src of [
      'javascript:alert(1)',
      'http://img.example/a.png',
      'data:image/png;base64,AAAA',
      '//evil.example/x.png',
    ]) {
      expect(await loadEditableImage(src, { loader })).toEqual({ ok: false, reason: 'blocked' });
    }
    expect(loader).not.toHaveBeenCalled();
    expect(await loadEditableImage('https://img.example/a.png', { loader })).toMatchObject({
      ok: true,
      src: 'https://img.example/a.png',
    });
    expect(
      await loadEditableImage('http://img.example/a.png', { loader, trust: 'developer' })
    ).toMatchObject({ ok: true });
  });

  it('reports failures, empty images, timeouts and aborts without throwing', async () => {
    expect(
      await loadEditableImage('/a.png', {
        loader: async () => {
          throw new Error('decode');
        },
      })
    ).toEqual({ ok: false, reason: 'error' });
    expect(
      await loadEditableImage('/a.png', { loader: async () => ({ ...image, width: 0 }) })
    ).toEqual({ ok: false, reason: 'error' });
    vi.useFakeTimers();
    const pending = loadEditableImage('/a.png', {
      loader: () => new Promise(() => {}),
      timeoutMs: 50,
    });
    await vi.advanceTimersByTimeAsync(60);
    expect(await pending).toEqual({ ok: false, reason: 'error' });
    vi.useRealTimers();
    const controller = new AbortController();
    controller.abort();
    expect(
      await loadEditableImage('/a.png', { loader: async () => image, signal: controller.signal })
    ).toEqual({ ok: false, reason: 'aborted' });
  });
});

describe('drawImageEdit', () => {
  const filtered = applyEditAction(createImageEdit(), {
    type: 'filter',
    name: 'grayscale',
    value: 100,
  });

  it('uses ctx.filter when the engine honors it, and draws annotations without it', () => {
    const ctx = new RecordingContext(true);
    const edit = applyEditAction(filtered, {
      type: 'add-annotation',
      annotation: {
        id: 'r',
        type: 'rect',
        color: '#e11d48',
        strokeWidth: 0.01,
        frame: { x: 0.5, y: 0.5, width: 0.25, height: 0.25 },
      },
    });
    const report = drawImageEdit(asContext(ctx), SOURCE, edit);
    expect(report).toEqual({ width: 400, height: 200, filters: 'canvas' });
    expect(ctx.calls.find((c) => c.name === 'drawImage')?.filter).toBe('grayscale(100%)');
    const rect = ctx.calls.find((c) => c.name === 'rect');
    expect(rect?.args).toEqual([200, 100, 100, 50]);
    expect(rect?.filter).toBe('none');
    expect(ctx.calls.some((c) => c.name === 'getImageData')).toBe(false);
  });

  it('falls back to pixel math when ctx.filter is ignored, and reports unreadable pixels', () => {
    const ctx = new RecordingContext(false);
    expect(supportsCanvasFilter(asContext(ctx))).toBe(false);
    expect(supportsCanvasFilter(asContext(new RecordingContext(true)))).toBe(true);
    const report = drawImageEdit(asContext(ctx), SOURCE, filtered);
    expect(report.filters).toBe('pixels');
    expect(ctx.calls.some((c) => c.name === 'putImageData')).toBe(true);
    const tainted = new RecordingContext(false);
    tainted.getImageDataThrows = true;
    expect(drawImageEdit(asContext(tainted), SOURCE, filtered).filters).toBe('unavailable');
    expect(
      drawImageEdit(asContext(new RecordingContext()), SOURCE, createImageEdit()).filters
    ).toBe('none');
  });

  it('draws text with a contrasting halo, arrows with a head, and ellipses', () => {
    const ctx = new RecordingContext();
    let edit = createImageEdit();
    for (const annotation of [
      {
        id: 't',
        type: 'text',
        color: '#ffffff',
        strokeWidth: 0.004,
        at: { x: 0.1, y: 0.1 },
        text: 'Gate 4',
        fontSize: 0.1,
      },
      {
        id: 'a',
        type: 'arrow',
        color: '#2563eb',
        strokeWidth: 0.01,
        from: { x: 0, y: 0 },
        to: { x: 1, y: 0 },
      },
      {
        id: 'e',
        type: 'ellipse',
        color: '#16a34a',
        strokeWidth: 0.01,
        frame: { x: 0, y: 0, width: 1, height: 1 },
      },
    ] as Annotation[]) {
      edit = applyEditAction(edit, { type: 'add-annotation', annotation });
    }
    drawImageEdit(asContext(ctx), SOURCE, edit, { fontFamily: 'Inter' });
    const fill = ctx.calls.find((c) => c.name === 'fillText');
    expect(fill?.args.slice(0, 3)).toEqual(['Gate 4', 40, 20]);
    expect(fill?.args[4]).toBe('600 20px Inter');
    expect(ctx.calls.find((c) => c.name === 'strokeText')?.args[3]).toBe('#000000');
    expect(ctx.calls.filter((c) => c.name === 'lineTo')).toHaveLength(3);
    expect(ctx.calls.find((c) => c.name === 'ellipse')?.args.slice(0, 4)).toEqual([
      200, 100, 200, 100,
    ]);
    expect(haloFor('#111827')).toBe('#ffffff');
  });

  it('can preview the whole oriented image for cropping', () => {
    const cropped = applyEditAction(createImageEdit(), {
      type: 'crop',
      rect: { x: 0.5, y: 0.5, width: 0.5, height: 0.5 },
    });
    const ctx = new RecordingContext();
    expect(drawImageEdit(asContext(ctx), SOURCE, cropped, { crop: 'ignore' })).toMatchObject({
      width: 400,
      height: 200,
    });
  });
});

describe('exportImageEdit', () => {
  const canvas = () => {
    const ctx = new RecordingContext();
    return { width: 0, height: 0, getContext: () => asContext(ctx) };
  };

  it('renders at the output size and returns the blob with the edit', async () => {
    const edit = applyEditAction(createImageEdit(), {
      type: 'resize',
      size: { width: 120, height: 60 },
    });
    const toBlob = vi.fn(async () => new Blob(['png'], { type: 'image/png' }));
    const result = await exportImageEdit(SOURCE, edit, {
      createCanvas: canvas,
      toBlob,
      type: 'image/gif' as never,
    });
    expect(result).toMatchObject({ ok: true, width: 120, height: 60, type: 'image/png', edit });
    expect(toBlob).toHaveBeenCalledWith(
      expect.objectContaining({ width: 120, height: 60 }),
      'image/png',
      0.92
    );
  });

  it('reports a tainted canvas and an engine that cannot encode', async () => {
    const edit = createImageEdit();
    const tainted = await exportImageEdit(SOURCE, edit, {
      createCanvas: canvas,
      toBlob: async () => {
        throw new DOMException('tainted', 'SecurityError');
      },
    });
    expect(tainted).toEqual({ ok: false, reason: 'tainted' });
    expect(
      await exportImageEdit(SOURCE, edit, { createCanvas: canvas, toBlob: async () => null })
    ).toEqual({ ok: false, reason: 'unsupported' });
    expect(
      await exportImageEdit(SOURCE, edit, {
        createCanvas: () => ({ width: 0, height: 0, getContext: () => null }),
      })
    ).toEqual({ ok: false, reason: 'unsupported' });
  });
});

// ── component ────────────────────────────────────────────────────────────

describe('ImageEditor', () => {
  const loader = vi.fn(async () => ({ source: {} as CanvasImageSource, width: 400, height: 200 }));

  // ImageEditor lazy-loads its editor chunk (a large component). Under the
  // full parallel suite its first transform can take longer than a
  // `vi.waitFor` budget, so load it once here (hook timeout, not a test
  // wait); every test then starts from the same loaded module.
  beforeAll(async () => {
    await import('../src/image-editor/Editor.svelte');
  });

  async function ready(props: Record<string, unknown> = {}) {
    const view = render(ImageEditor, {
      props: { src: '/harbor.png', alt: 'Harbor at dawn', loader, ...props } as never,
    });
    await vi.waitFor(() =>
      expect(view.container.querySelector('[data-status="ready"]')).toBeTruthy()
    );
    await tick();
    return view;
  }

  it('refuses an unsafe source without requesting it, and reports its status', async () => {
    loader.mockClear();
    const onstatus = vi.fn();
    const view = render(ImageEditor, {
      props: { src: 'javascript:alert(1)', alt: 'x', loader, onstatus } as never,
    });
    await vi.waitFor(() => expect(view.getByRole('alert').textContent).toContain('not allowed'));
    expect(loader).not.toHaveBeenCalled();
    expect(onstatus.mock.calls.map(([status]) => status)).toEqual(['loading', 'blocked']);
    expect(view.queryByRole('img')).toBeNull();
  });

  it('names the preview and describes the edit', async () => {
    const view = await ready();
    const picture = view.getByRole('img', { name: 'Harbor at dawn' });
    const summary = document.getElementById(picture.getAttribute('aria-describedby') ?? '');
    expect(summary?.textContent).toBe('No edits.');
    await fireEvent.click(view.getByRole('button', { name: 'Rotate right' }));
    expect(summary?.textContent).toBe('rotated 90°, 200 × 400 pixels');
  });

  it('rotates, flips, undoes and redoes, reporting each change', async () => {
    const onchange = vi.fn();
    const view = await ready({ onchange });
    await fireEvent.click(view.getByRole('button', { name: 'Rotate right' }));
    const flip = view.getByRole('button', { name: 'Flip horizontally' });
    await fireEvent.click(flip);
    expect(flip.getAttribute('aria-pressed')).toBe('true');
    expect(onchange.mock.lastCall?.[0]).toMatchObject({ rotate: 90, flipX: true });
    await fireEvent.click(view.getByRole('button', { name: 'Undo' }));
    expect(onchange.mock.lastCall?.[0]).toMatchObject({ rotate: 90, flipX: false });
    // Ctrl+Z from anywhere in the editor, but not inside a text field.
    await fireEvent.keyDown(view.getByRole('button', { name: 'Redo' }), {
      key: 'z',
      ctrlKey: true,
    });
    expect(onchange.mock.lastCall?.[0]).toMatchObject({ rotate: 0 });
    await fireEvent.keyDown(view.getByRole('button', { name: 'Redo' }), {
      key: 'z',
      ctrlKey: true,
      shiftKey: true,
    });
    expect(onchange.mock.lastCall?.[0]).toMatchObject({ rotate: 90 });
  });

  it('adjusts filters with labelled sliders', async () => {
    const onchange = vi.fn();
    const view = await ready({ onchange });
    const slider = view.getByRole('slider', { name: 'Brightness' });
    await fireEvent.input(slider, { target: { value: '140' } });
    expect(onchange.mock.lastCall?.[0].filters.brightness).toBe(140);
    expect(slider.getAttribute('aria-valuetext')).toBe('140%');
  });

  it('crops with the keyboard: arrows move the box and Shift+arrows resize it', async () => {
    const onchange = vi.fn();
    const view = await ready({ onchange });
    await fireEvent.click(view.getByRole('button', { name: 'Edit crop' }));
    await fireEvent.change(view.getByLabelText('Width (%)'), { target: { value: '50' } });
    const box = view.getByRole('group', { name: /Crop area/ });
    expect(box.tabIndex).toBe(0);
    await fireEvent.keyDown(box, { key: 'ArrowRight' });
    await fireEvent.keyDown(box, { key: 'ArrowDown', shiftKey: true });
    const crop = onchange.mock.lastCall?.[0].crop;
    expect(crop.x).toBeCloseTo(0.01);
    expect(crop.width).toBeCloseTo(0.5);
    expect(crop.height).toBeCloseTo(1);
    expect(box.getAttribute('aria-label')).toBe(
      'Crop area: 1% from the left, 0% from the top, 50% wide, 100% high'
    );
    await fireEvent.click(view.getByRole('button', { name: 'Remove crop' }));
    expect(onchange.mock.lastCall?.[0].crop).toBeUndefined();
  });

  it('offers an accessible square crop preset that preserves the crop center', async () => {
    const onchange = vi.fn();
    const view = await ready({ onchange });
    await fireEvent.click(view.getByRole('button', { name: 'Edit crop' }));
    await fireEvent.change(view.getByLabelText('Crop aspect ratio'), {
      target: { value: 'square' },
    });
    expect(onchange.mock.lastCall?.[0].crop).toEqual({ x: 0.25, y: 0, width: 0.5, height: 1 });
  });

  it('adds, recolors, moves with arrows and deletes annotations', async () => {
    const onchange = vi.fn();
    const view = await ready({ onchange });
    await fireEvent.click(view.getByRole('button', { name: 'Add text' }));
    const item = view.getByRole('button', { name: 'Text 1' });
    expect(item.getAttribute('aria-pressed')).toBe('true');
    await fireEvent.click(view.getByRole('button', { name: 'Blue' }));
    expect(onchange.mock.lastCall?.[0].annotations[0].color).toBe('#2563eb');
    await fireEvent.input(view.getByRole('textbox', { name: 'Text' }), {
      target: { value: 'Pier 3' },
    });
    expect(onchange.mock.lastCall?.[0].annotations[0].text).toBe('Pier 3');
    await fireEvent.keyDown(item, { key: 'ArrowRight', shiftKey: true });
    expect(onchange.mock.lastCall?.[0].annotations[0].at.x).toBeCloseTo(0.15);
    await fireEvent.keyDown(item, { key: 'Delete' });
    expect(onchange.mock.lastCall?.[0].annotations).toEqual([]);
    expect(view.getByText('No annotations yet.')).toBeTruthy();
  });

  it('applies a valid incoming value and refuses an invalid one', async () => {
    const oninvalid = vi.fn();
    const edit = applyEditAction(createImageEdit(), { type: 'flip', axis: 'y' });
    const view = await ready({ value: edit, oninvalid });
    expect(view.getByRole('button', { name: 'Flip vertically' }).getAttribute('aria-pressed')).toBe(
      'true'
    );
    await view.rerender({ value: { version: 1, rotate: 33 } } as never);
    flushSync();
    expect(oninvalid).toHaveBeenCalledWith([expect.objectContaining({ path: '$.rotate' })]);
    expect(view.getByRole('button', { name: 'Flip vertically' }).getAttribute('aria-pressed')).toBe(
      'true'
    );
  });

  it('exports and announces the result', async () => {
    const onexport = vi.fn();
    const view = await ready({
      onexport,
      exportOptions: {
        createCanvas: () => ({
          width: 0,
          height: 0,
          getContext: () => asContext(new RecordingContext()),
        }),
        toBlob: async () => new Blob(['x'], { type: 'image/webp' }),
      },
    });
    await fireEvent.change(view.getByLabelText('Format'), { target: { value: 'image/webp' } });
    await fireEvent.click(view.getByRole('button', { name: 'Export image' }));
    await vi.waitFor(() => expect(onexport).toHaveBeenCalled());
    expect(onexport.mock.lastCall?.[0]).toMatchObject({
      ok: true,
      type: 'image/webp',
      width: 400,
      height: 200,
    });
    await vi.waitFor(() =>
      expect(
        view.getAllByRole('status').some((s) => s.textContent === 'Exported a 400 × 200 image.')
      ).toBe(true)
    );
  });

  it('renders translated labels', async () => {
    const view = await ready({
      labels: { rotateRight: 'Girar a la derecha', filters: { brightness: 'Brillo' } },
    });
    expect(view.getByRole('button', { name: 'Girar a la derecha' })).toBeTruthy();
    expect(view.getByRole('slider', { name: 'Brillo' })).toBeTruthy();
    expect(view.getByRole('slider', { name: 'Contrast' })).toBeTruthy();
  });
});

describe('cropToAspectRatio', () => {
  it('fits the requested ratio inside the current crop using oriented source pixels', () => {
    expect(
      cropToAspectRatio({ x: 0, y: 0, width: 1, height: 1 }, { width: 400, height: 200 }, 1)
    ).toEqual({
      x: 0.25,
      y: 0,
      width: 0.5,
      height: 1,
    });
  });
});

describe('image editor stylesheet', () => {
  const source = readFileSync(
    join(import.meta.dirname, '..', 'src', 'image-editor', 'Editor.svelte'),
    'utf8'
  );
  const css = source.slice(source.indexOf('<style>'));
  /** The value of every declaration with its var() fallbacks removed. */
  const bareValues = [...css.matchAll(/[a-z-]+:\s*([^;{}]+);/g)].map((match) => {
    let value = match[1] ?? '';
    // Strip var(--token, fallback) innermost first, so only bare literals stay.
    for (let previous = ''; previous !== value; ) {
      previous = value;
      value = value.replace(/var\(--[a-z-]+(?:,[^()]*(?:\([^()]*\)[^()]*)*)?\)/g, 'TOKEN');
    }
    return value;
  });

  // T-70: chrome colors follow the --tx-* contract (literals only as var() fallbacks).
  it('has no bare color literals outside var() fallbacks', () => {
    const offenders = bareValues.filter((value) =>
      /#[\da-f]{3,8}\b|light-dark\(|oklch\(|rgb\((?!0 0 0 \/ 0\.001\))/i.test(value)
    );
    expect(offenders).toEqual([]);
  });

  it('dims outside the crop with the theme scrim token', () => {
    expect(css).toMatch(/box-shadow:\s*0 0 0 100vmax var\(--tx-scrim/);
  });
});
