import { cleanup, fireEvent, render, waitFor } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { mixOklch } from '../src/animation/index.ts';
import type { Composition } from '../src/composition-model/index.ts';
import {
  downloadBlob,
  type ExportCanvas,
  exportFilename,
  exportPng,
  exportSvg,
  exportWebm,
  pickWebmMimeType,
  type RecorderConstructor,
  type RecorderLike,
  WEBM_EXPORT_MIME_TYPE,
  WEBM_LIMITS,
  type WebmFrameClock,
  webmFrameTimes,
} from '../src/export/index.ts';
import { CompositionExport, resolveCompositionExportLabels } from '../src/export/ui.ts';

const RLO = '\u202e';

const composition: Composition = {
  version: 1,
  width: 120,
  height: 80,
  layers: [
    {
      id: 'box',
      type: 'shape',
      shape: 'rectangle',
      frame: { x: 0, y: 0, width: 120, height: 80 },
      fill: { kind: 'solid', color: '#ff0000' },
    },
    {
      id: 'label',
      type: 'text',
      frame: { x: 8, y: 8, width: 100, height: 20 },
      text: '<script>alert(1)</script> & "Harbor"',
      paint: { kind: 'solid', color: '#ffffff' },
      fontSize: 12,
    },
  ],
};

const withImage = (src: string): Composition => ({
  ...composition,
  layers: [
    ...composition.layers,
    {
      id: 'photo',
      type: 'image',
      frame: { x: 0, y: 0, width: 40, height: 40 },
      src,
      alt: 'Fictional photo',
    },
  ],
});

const generatedProvenance = {
  source: 'model',
  createdAt: '2026-10-24T18:30:00.000Z',
  generatorKind: 'image',
  providerLabel: 'host:mock',
  promptHash: 'a'.repeat(64),
  options: { aspectRatio: '16:9' },
} as const;

const withGeneratedImage = (): Composition => ({
  ...composition,
  layers: [
    {
      id: 'photo',
      type: 'image',
      frame: { x: 0, y: 0, width: 40, height: 40 },
      src: 'https://images.example.com/harbor.png',
      alt: 'Fictional photo',
      provenance: generatedProvenance,
    },
    ...composition.layers,
  ],
});

const animation = {
  version: 1,
  durationMs: 1000,
  tracks: [
    {
      layerId: 'box',
      keyframes: [
        { timeMs: 0, fill: '#ff0000', translateX: 0 },
        { timeMs: 1000, fill: '#0000ff', translateX: 20 },
      ],
    },
  ],
};

/** A 2D context that accepts every call and records the fill styles it was given. */
function fakeContext() {
  const fills: unknown[] = [];
  const store: Record<string | symbol, unknown> = { globalAlpha: 1 };
  const gradient = { addColorStop() {} };
  const context = new Proxy(store, {
    has: () => true,
    get(target, key) {
      if (key in target) return target[key];
      if (key === 'measureText') return (text: string) => ({ width: text.length * 6 });
      if (key === 'getImageData') {
        return (_x: number, _y: number, w: number, h: number) => ({
          data: new Uint8ClampedArray(Math.max(1, w * h * 4)),
          width: w,
          height: h,
        });
      }
      return () => gradient;
    },
    set(target, key, value) {
      if (key === 'fillStyle') fills.push(value);
      target[key] = value;
      return true;
    },
  });
  return { context, fills };
}

interface FakeCanvasOptions {
  blob?: Blob | null;
  toBlobError?: string;
  offscreen?: boolean;
  capture?: boolean;
}

function fakeCanvas(options: FakeCanvasOptions = {}) {
  const { context, fills } = fakeContext();
  const track = { requestFrame: vi.fn(), stop: vi.fn() };
  const canvas: ExportCanvas & { width: number; height: number } = {
    width: 0,
    height: 0,
    getContext: () => context,
  };
  if (options.offscreen) {
    canvas.convertToBlob = async ({ type } = {}) => new Blob(['png'], { type });
  } else {
    canvas.toBlob = (callback, type) => {
      if (options.toBlobError) {
        const error = new Error('read refused');
        error.name = options.toBlobError;
        throw error;
      }
      callback(options.blob === undefined ? new Blob(['png'], { type }) : options.blob);
    };
  }
  if (options.capture !== false) {
    canvas.captureStream = () =>
      ({
        getVideoTracks: () => [track],
        getTracks: () => [track],
      }) as unknown as MediaStream;
  }
  return { canvas, fills, track };
}

function fakeRecorder(
  options: {
    supported?: string[];
    failOnStart?: boolean;
    throwOnCreate?: boolean;
    throwOnStart?: boolean;
    throwOnStop?: boolean;
  } = {}
) {
  const instances: FakeRecorder[] = [];
  class FakeRecorder implements RecorderLike {
    static isTypeSupported(type: string) {
      return (options.supported ?? [WEBM_EXPORT_MIME_TYPE]).includes(type);
    }
    readonly mimeType: string;
    readonly videoBitsPerSecond: number;
    ondataavailable: ((event: { data: Blob }) => void) | null = null;
    onstop: (() => void) | null = null;
    onerror: ((event: unknown) => void) | null = null;
    started = false;
    stopped = false;
    timesliceMs: number | undefined;
    constructor(_stream: MediaStream, init: { mimeType: string; videoBitsPerSecond: number }) {
      if (options.throwOnCreate) throw new Error('no encoder');
      this.mimeType = init.mimeType;
      this.videoBitsPerSecond = init.videoBitsPerSecond;
      instances.push(this);
    }
    start(timesliceMs?: number) {
      if (options.throwOnStart) throw new Error('start refused');
      this.started = true;
      this.timesliceMs = timesliceMs;
      if (options.failOnStart) this.onerror?.(new Error('encoder crashed'));
    }
    stop() {
      if (options.throwOnStop) throw new Error('stop refused');
      this.stopped = true;
      if (!options.failOnStart)
        this.ondataavailable?.({ data: new Blob(['webm'], { type: 'video/webm' }) });
      queueMicrotask(() => this.onstop?.());
    }
  }
  return { Recorder: FakeRecorder as unknown as RecorderConstructor, instances };
}

const immediateFrameClock: WebmFrameClock = {
  now: () => 0,
  waitUntil: async () => {},
};

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('exportFilename', () => {
  it('→; caps the stem at 80 characters', () => {
    // →
    for (const [name, format, expected] of [
      ['Harbor poster', 'png', 'Harbor poster.png'],
      ['../../etc/passwd', 'svg', 'etc-passwd.svg'],
      ['C:\\Users\\a\\b', 'png', 'C-Users-a-b.png'],
      [`invoice${RLO}gpj.exe`, 'png', 'invoice-gpj.exe.png'],
      ['line\nbreak\u0000null', 'webm', 'line-break-null.webm'],
      ['  .hidden  ', 'png', 'hidden.png'],
      ['poster.PNG', 'png', 'poster.png'],
      ['café 東京', 'svg', 'café 東京.svg'],
      ['', 'png', 'composition.png'],
      [undefined, 'webm', 'composition.webm'],
      ['<script>', 'svg', 'script.svg'],
    ] as const) {
      expect(exportFilename(name, format), String(name)).toBe(expected);

      cleanup();
    }
    cleanup();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    // caps the stem at 80 characters
    expect(exportFilename('a'.repeat(200), 'png')).toBe(`${'a'.repeat(80)}.png`);
  });
});

describe('exportSvg', () => {
  it('retains image generation provenance in the export sidecar, and 4 related cases', async () => {
    // retains image generation provenance in the export sidecar
    await (async () => {
      const provenance = {
        source: 'model',
        createdAt: '2026-10-24T18:30:00.000Z',
        generatorKind: 'image',
        providerLabel: 'host:mock',
        promptHash: 'a'.repeat(64),
        options: { aspectRatio: '16:9' },
      } as const;
      const result = await exportSvg({
        ...composition,
        layers: [
          ...composition.layers,
          {
            id: 'generated-cover',
            type: 'image',
            frame: { x: 0, y: 0, width: 40, height: 40 },
            src: 'https://images.example.com/harbor.png',
            alt: 'Fictional harbor',
            provenance,
          },
        ],
      });

      expect(result.ok).toBe(true);
      if (result.ok)
        expect(result.provenance).toEqual([{ layerId: 'generated-cover', provenance }]);
    })();
    cleanup();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    // serializes a standalone, escaped SVG file
    await (async () => {
      const result = await exportSvg(composition, { title: 'Poster & co', filename: 'poster' });
      if (!result.ok) throw new Error('expected ok');
      expect(result.filename).toBe('poster.svg');
      expect(result.blob.type).toBe('image/svg+xml;charset=utf-8');
      expect(result.svg.startsWith('<?xml version="1.0" encoding="UTF-8"?>\n<svg')).toBe(true);
      expect(result.svg).toContain('<title>Poster &amp; co</title>');
      expect(result.svg).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
      expect(result.svg).not.toContain('<script');
      expect(result.svg).not.toContain('tabindex');
      expect(await result.blob.text()).toBe(result.svg);
      expect([result.width, result.height]).toEqual([120, 80]);
    })();
    cleanup();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    // rejects
    await (async () => {
      for (const [_name, src] of [
        ['a javascript: image', 'javascript:alert(1)'],
        ['a data: image (untrusted)', 'data:image/png;base64,iVBORw0KGgo='],
        ['an http: image (untrusted)', 'http://example.com/a.png'],
      ] as const) {
        const result = await exportSvg(withImage(src));
        expect(result.ok, String(_name)).toBe(false);
        if (!result.ok)
          expect(
            result.errors.some((error) => error.code === 'unsafe-source'),
            String(_name)
          ).toBe(true);

        cleanup();
      }
    })();
    cleanup();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    // allows an http image for developer data, and an https image always
    await (async () => {
      expect(
        (await exportSvg(withImage('http://example.com/a.png'), { trust: 'developer' })).ok
      ).toBe(true);
      const https = await exportSvg(withImage('https://example.com/a.png'));
      expect(https.ok && https.svg).toContain('https://example.com/a.png');
    })();
    cleanup();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    // rejects invalid documents without throwing
    await (async () => {
      expect((await exportSvg(null)).ok).toBe(false);
      expect((await exportSvg({ ...composition, version: 2 })).ok).toBe(false);
      expect(
        (await exportSvg({ ...composition, layers: [{ id: 'x', type: 'html', html: '<b>' }] })).ok
      ).toBe(false);
    })();
  });
});

describe('exportPng', () => {
  it('returns image provenance as sidecar metadata, and 7 related cases', async () => {
    // returns image provenance as sidecar metadata
    await (async () => {
      const { canvas } = fakeCanvas();
      const result = await exportPng(withGeneratedImage(), {
        createCanvas: () => canvas,
        loadImage: async () => null,
      });
      expect(result.ok && result.provenance).toEqual([
        { layerId: 'photo', provenance: generatedProvenance },
      ]);
    })();
    cleanup();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    // draws on an offscreen canvas and encodes a PNG at the pixel ratio
    await (async () => {
      const { canvas, fills } = fakeCanvas();
      const result = await exportPng(composition, {
        createCanvas: () => canvas,
        pixelRatio: 2,
        background: '#000000',
        filename: 'poster',
      });
      if (!result.ok) throw new Error(`expected ok, got ${result.reason}`);
      expect(result.blob.type).toBe('image/png');
      expect(result.filename).toBe('poster.png');
      expect([result.width, result.height]).toEqual([240, 160]);
      expect(fills).toContain('#000000');
      expect(fills).toContain('#ff0000');
    })();
    cleanup();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    // loads images through the URL policy and reports what was left out
    await (async () => {
      const { canvas } = fakeCanvas();
      const loadImage = vi.fn(async () => null);
      const result = await exportPng(withImage('https://example.com/missing.png'), {
        createCanvas: () => canvas,
        loadImage,
      });
      expect(result.ok && result.failedSources).toEqual(['https://example.com/missing.png']);
      expect(loadImage).toHaveBeenCalledWith('https://example.com/missing.png', undefined);
    })();
    cleanup();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    // rejects unsafe sources before fetching anything
    await (async () => {
      const { canvas } = fakeCanvas();
      const loadImage = vi.fn(async () => null);
      const result = await exportPng(withImage('javascript:alert(1)'), {
        createCanvas: () => canvas,
        loadImage,
      });
      expect(result.ok).toBe(false);
      if (!result.ok && result.reason === 'invalid') {
        expect(result.errors.map((error) => error.code)).toContain('unsafe-source');
      }
      expect(loadImage).not.toHaveBeenCalled();
    })();
    cleanup();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    // turns a tainted canvas into a reason, not an exception
    await (async () => {
      const { canvas } = fakeCanvas({ toBlobError: 'SecurityError' });
      expect(await exportPng(composition, { createCanvas: () => canvas })).toEqual({
        ok: false,
        reason: 'tainted',
      });
    })();
    cleanup();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    // reports encoder failures and missing canvases
    await (async () => {
      const empty = fakeCanvas({ blob: null });
      expect(await exportPng(composition, { createCanvas: () => empty.canvas })).toEqual({
        ok: false,
        reason: 'encode-failed',
      });
      expect(await exportPng(composition, { createCanvas: () => null })).toEqual({
        ok: false,
        reason: 'unsupported',
      });
    })();
    cleanup();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    // uses convertToBlob on an OffscreenCanvas
    await (async () => {
      const { canvas } = fakeCanvas({ offscreen: true });
      const result = await exportPng(composition, { createCanvas: () => canvas });
      expect(result.ok && result.blob.type).toBe('image/png');
    })();
    cleanup();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    // stops when aborted
    await (async () => {
      const { canvas } = fakeCanvas();
      const controller = new AbortController();
      controller.abort();
      const result = await exportPng(composition, {
        createCanvas: () => canvas,
        signal: controller.signal,
      });
      expect(result).toEqual({ ok: false, reason: 'aborted' });
    })();
  });
});

describe('exportWebm', () => {
  it('records only a validated animation trim range through the frame clock, and 13 related cases', async () => {
    // records only a validated animation trim range through the frame clock
    await (async () => {
      const { canvas, fills, track } = fakeCanvas();
      const { Recorder } = fakeRecorder();
      const waits: number[] = [];
      const result = await exportWebm(composition, animation, {
        createCanvas: () => canvas,
        Recorder,
        fps: 10,
        trim: { startMs: 200, endMs: 400 },
        frameClock: {
          now: () => 0,
          waitUntil: async (deadline) => {
            waits.push(deadline);
          },
        },
      });
      expect(result.ok && result.frames).toBe(3);
      expect(result.ok && result.sourceRange).toEqual({ startMs: 200, endMs: 400 });
      expect(waits).toEqual([100, 200]);
      expect(track.requestFrame).toHaveBeenCalledTimes(3);
      expect(fills).toContain(mixOklch('#ff0000', '#0000ff', 0.2));
      expect(fills).toContain(mixOklch('#ff0000', '#0000ff', 0.4));

      const invalid = await exportWebm(composition, animation, {
        createCanvas: () => canvas,
        Recorder,
        trim: { startMs: 400, endMs: 300 },
      });
      expect(invalid).toMatchObject({ ok: false, reason: 'invalid', errors: [{ path: 'trim' }] });
    })();
    cleanup();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    // returns image provenance as sidecar metadata
    await (async () => {
      const { canvas } = fakeCanvas();
      const { Recorder } = fakeRecorder();
      const result = await exportWebm(withGeneratedImage(), animation, {
        createCanvas: () => canvas,
        Recorder,
        frameClock: immediateFrameClock,
        loadImage: async () => null,
      });
      expect(result.ok && result.provenance).toEqual([
        { layerId: 'photo', provenance: generatedProvenance },
      ]);
    })();
    cleanup();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    // samples one frame per tick, draws it and records WebM
    await (async () => {
      const { canvas, fills, track } = fakeCanvas();
      const { Recorder, instances } = fakeRecorder();
      const progress: number[] = [];
      const submittedAtProgress: number[] = [];
      const result = await exportWebm(composition, animation, {
        createCanvas: () => canvas,
        Recorder,
        frameClock: immediateFrameClock,
        fps: 10,
        filename: 'orb',
        onProgress: (done) => {
          progress.push(done);
          submittedAtProgress.push(track.requestFrame.mock.calls.length);
        },
      });
      if (!result.ok) throw new Error(`expected ok, got ${result.reason}`);
      expect(result.frames).toBe(11);
      expect(result.mimeType).toBe(WEBM_EXPORT_MIME_TYPE);
      expect(result.blob.type).toBe('video/webm');
      expect(result.filename).toBe('orb.webm');
      expect(track.requestFrame).toHaveBeenCalledTimes(11);
      expect(progress).toEqual(Array.from({ length: 11 }, (_, i) => (i + 1) / 11));
      expect(submittedAtProgress).toEqual(Array.from({ length: 11 }, (_, i) => i + 1));
      expect(progress.every((value, i) => i === 0 || value >= (progress[i - 1] ?? 0))).toBe(true);
      expect(track.stop).toHaveBeenCalled();
      expect(progress.at(-1)).toBe(1);
      expect(instances[0]?.started && instances[0]?.stopped).toBe(true);
      expect(instances[0]).toMatchObject({
        mimeType: WEBM_EXPORT_MIME_TYPE,
        videoBitsPerSecond: WEBM_LIMITS.videoBitsPerSecond,
        timesliceMs: WEBM_LIMITS.dataChunkMs,
      });
      // The color keyframes reach the canvas, mixed in OKLCH.
      expect(fills).toContain('#ff0000');
      expect(fills).toContain(mixOklch('#ff0000', '#0000ff', 0.5));
      expect(fills).toContain('#0000ff');
    })();
    cleanup();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    // paces frames in real time
    await (async () => {
      const { canvas } = fakeCanvas();
      const { Recorder } = fakeRecorder();
      const deadlines: number[] = [];
      let now = 10_000;
      await exportWebm(composition, animation, {
        createCanvas: () => canvas,
        Recorder,
        fps: 25,
        frameClock: {
          now: () => now,
          waitUntil: async (deadline) => {
            deadlines.push(deadline);
            now = Math.max(now, deadline);
          },
        },
      });
      expect(deadlines).toEqual(Array.from({ length: 25 }, (_, i) => 10_000 + (i + 1) * 40));
    })();
    cleanup();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    // validates the animation against the composition
    await (async () => {
      const { canvas } = fakeCanvas();
      const { Recorder } = fakeRecorder();
      const result = await exportWebm(
        composition,
        { version: 1, durationMs: 100, tracks: [{ layerId: 'ghost', keyframes: [{ timeMs: 0 }] }] },
        { createCanvas: () => canvas, Recorder, frameClock: immediateFrameClock }
      );
      expect(result.ok).toBe(false);
      if (!result.ok && result.reason === 'invalid') {
        expect(result.errors[0]?.path).toBe('animation.tracks[0].layerId');
      }
      const css = await exportWebm(
        composition,
        {
          version: 1,
          durationMs: 100,
          tracks: [{ layerId: 'box', keyframes: [{ timeMs: 0, fill: 'url(x)' }] }],
        },
        { createCanvas: () => canvas, Recorder, frameClock: immediateFrameClock }
      );
      expect(css.ok).toBe(false);
    })();
    cleanup();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    // rejects an unsafe image source
    await (async () => {
      const { canvas } = fakeCanvas();
      const { Recorder } = fakeRecorder();
      const result = await exportWebm(withImage('javascript:alert(1)'), animation, {
        createCanvas: () => canvas,
        Recorder,
        frameClock: immediateFrameClock,
      });
      expect(result.ok).toBe(false);
    })();
    cleanup();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    // is unsupported without a recorder, a WebM type or canvas capture
    await (async () => {
      const { canvas } = fakeCanvas();
      expect(
        await exportWebm(composition, animation, {
          createCanvas: () => canvas,
          Recorder: undefined,
          frameClock: immediateFrameClock,
        })
      ).toEqual({ ok: false, reason: 'unsupported' });
      const mp4Only = fakeRecorder({ supported: ['video/mp4'] });
      expect(
        await exportWebm(composition, animation, {
          createCanvas: () => canvas,
          Recorder: mp4Only.Recorder,
          frameClock: immediateFrameClock,
        })
      ).toEqual({ ok: false, reason: 'unsupported' });
      const noCapture = fakeCanvas({ capture: false });
      expect(
        await exportWebm(composition, animation, {
          createCanvas: () => noCapture.canvas,
          Recorder: fakeRecorder().Recorder,
          frameClock: immediateFrameClock,
        })
      ).toEqual({ ok: false, reason: 'unsupported' });
    })();
    cleanup();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    // rejects streams without a manually requestable video frame track
    await (async () => {
      const canvas = fakeCanvas();
      const track = { stop: vi.fn() };
      canvas.canvas.captureStream = () =>
        ({ getVideoTracks: () => [track], getTracks: () => [track] }) as unknown as MediaStream;
      expect(
        await exportWebm(composition, animation, {
          createCanvas: () => canvas.canvas,
          Recorder: fakeRecorder().Recorder,
          frameClock: immediateFrameClock,
        })
      ).toEqual({ ok: false, reason: 'unsupported' });
      expect(track.stop).toHaveBeenCalled();
    })();
    cleanup();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    // stops recording when aborted mid-way
    await (async () => {
      const { canvas, track } = fakeCanvas();
      const { Recorder, instances } = fakeRecorder();
      const controller = new AbortController();
      let frames = 0;
      const result = await exportWebm(composition, animation, {
        createCanvas: () => canvas,
        Recorder,
        fps: 10,
        signal: controller.signal,
        frameClock: {
          now: () => 0,
          waitUntil: async (_deadline, signal) => {
            frames += 1;
            if (frames === 3) controller.abort();
            if (signal?.aborted) return;
          },
        },
      });
      expect(result).toEqual({ ok: false, reason: 'aborted' });
      expect(track.requestFrame).toHaveBeenCalledTimes(3);
      expect(instances[0]?.stopped).toBe(true);
      expect(track.stop).toHaveBeenCalled();
    })();
    cleanup();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    // cancels a pending frame deadline and releases recorder and tracks
    await (async () => {
      const { canvas, track } = fakeCanvas();
      const { Recorder, instances } = fakeRecorder();
      const controller = new AbortController();
      let waiting = false;
      const clock: WebmFrameClock = {
        now: () => 0,
        waitUntil: (_deadline, signal) =>
          new Promise<void>((resolve) => {
            waiting = true;
            signal?.addEventListener('abort', () => resolve(), { once: true });
          }),
      };
      const resultPromise = exportWebm(composition, animation, {
        createCanvas: () => canvas,
        Recorder,
        fps: 1,
        signal: controller.signal,
        frameClock: clock,
      });
      await vi.waitFor(() => expect(waiting).toBe(true));
      controller.abort();
      expect(await resultPromise).toEqual({ ok: false, reason: 'aborted' });
      expect(instances[0]?.stopped).toBe(true);
      expect(track.requestFrame).toHaveBeenCalledTimes(1);
      expect(track.stop).toHaveBeenCalled();
    })();
    cleanup();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    // reports recorder failures
    await (async () => {
      const { canvas } = fakeCanvas();
      expect(
        await exportWebm(composition, animation, {
          createCanvas: () => canvas,
          Recorder: fakeRecorder({ failOnStart: true }).Recorder,
          frameClock: immediateFrameClock,
        })
      ).toEqual({ ok: false, reason: 'recorder-failed' });
      expect(
        await exportWebm(composition, animation, {
          createCanvas: () => canvas,
          Recorder: fakeRecorder({ throwOnCreate: true }).Recorder,
          frameClock: immediateFrameClock,
        })
      ).toEqual({ ok: false, reason: 'recorder-failed' });
    })();
    cleanup();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    // contains recorder start and stop exceptions and always releases the stream
    await (async () => {
      const startFailure = fakeCanvas();
      expect(
        await exportWebm(composition, animation, {
          createCanvas: () => startFailure.canvas,
          Recorder: fakeRecorder({ throwOnStart: true }).Recorder,
          frameClock: immediateFrameClock,
        })
      ).toEqual({ ok: false, reason: 'recorder-failed' });
      expect(startFailure.track.stop).toHaveBeenCalled();

      const stopFailure = fakeCanvas();
      expect(
        await exportWebm(composition, animation, {
          createCanvas: () => stopFailure.canvas,
          Recorder: fakeRecorder({ throwOnStop: true }).Recorder,
          frameClock: immediateFrameClock,
        })
      ).toEqual({ ok: false, reason: 'recorder-failed' });
      expect(stopFailure.track.stop).toHaveBeenCalled();
    })();
    cleanup();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    // clamps the frame rate and lists frame times up to the end
    expect(webmFrameTimes(1000, 4)).toEqual([0, 250, 500, 750, 1000]);
    expect(webmFrameTimes(100, 30)).toEqual([0, 100 / 3, 200 / 3, 100]);
    expect(webmFrameTimes(1, 60)).toEqual([0, 1]);
    cleanup();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    // picks the first supported WebM type
    expect(pickWebmMimeType(undefined)).toBeNull();
    expect(pickWebmMimeType(fakeRecorder({ supported: ['video/webm;codecs=vp8'] }).Recorder)).toBe(
      'video/webm;codecs=vp8'
    );
    expect(pickWebmMimeType(fakeRecorder({ supported: [] }).Recorder)).toBeNull();
  });
});

describe('downloadBlob', () => {
  it('clicks a temporary download link and revokes the object URL; returns false when object URLs are unavailable', async () => {
    // clicks a temporary download link and revokes the object URL
    await (async () => {
      const create = vi.fn(() => 'blob:https://example.com/1');
      const revoke = vi.fn();
      vi.stubGlobal('URL', { createObjectURL: create, revokeObjectURL: revoke });
      const clicks: HTMLAnchorElement[] = [];
      const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
        this: HTMLAnchorElement
      ) {
        clicks.push(this);
      });
      const blob = new Blob(['x'], { type: 'image/png' });
      expect(downloadBlob(blob, 'poster.png', document)).toBe(true);
      expect(create).toHaveBeenCalledWith(blob);
      expect(click).toHaveBeenCalledOnce();
      expect(clicks[0]?.download).toBe('poster.png');
      expect(clicks[0]?.getAttribute('href')).toBe('blob:https://example.com/1');
      expect(document.querySelector('a[download]')).toBeNull();
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(revoke).toHaveBeenCalledWith('blob:https://example.com/1');
    })();
    cleanup();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    // returns false when object URLs are unavailable
    vi.stubGlobal('URL', {});
    expect(downloadBlob(new Blob(['x']), 'a.png', document)).toBe(false);
  });
});

describe('CompositionExport', () => {
  it('exports SVG from a keyboard-operable button and announces the file, and 3 related cases', async () => {
    // exports SVG from a keyboard-operable button and announces the file
    await (async () => {
      vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
      vi.stubGlobal('URL', { createObjectURL: () => 'blob:x', revokeObjectURL: () => {} });
      const onexport = vi.fn();
      const view = render(CompositionExport, {
        props: { composition, filename: 'poster', onexport },
      });
      expect(view.getByRole('group', { name: 'Export' })).toBeTruthy();
      const button = view.getByRole('button', { name: 'Export SVG' });
      expect(button.tagName).toBe('BUTTON');
      await fireEvent.click(button);
      await waitFor(() => expect(onexport).toHaveBeenCalledOnce());
      expect(onexport.mock.calls[0]?.[0]).toMatchObject({ format: 'svg', filename: 'poster.svg' });
      await waitFor(() => expect(view.getByRole('status').textContent).toBe('Saved poster.svg.'));
      expect(view.queryByRole('button', { name: 'Export WebM' })).toBeNull();
    })();
    cleanup();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    // says why an invalid composition cannot be exported
    await (async () => {
      const view = render(CompositionExport, {
        props: { composition: withImage('javascript:alert(1)') },
      });
      await fireEvent.click(view.getByRole('button', { name: 'Export SVG' }));
      await waitFor(() =>
        expect(view.getByRole('status').textContent).toBe(resolveCompositionExportLabels().invalid)
      );
      expect(view.getByRole('status').getAttribute('data-tone')).toBe('error');
    })();
    cleanup();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    // disables WebM with a reason where the browser cannot record it
    await (async () => {
      vi.stubGlobal('MediaRecorder', undefined);
      const view = render(CompositionExport, {
        props: {
          composition,
          animation,
          labels: { webm: 'WebM', webmUnsupported: 'Sin WebM aquí.' },
        },
      });
      const button = view.getByRole('button', { name: 'WebM' }) as HTMLButtonElement;
      await waitFor(() => expect(button.disabled).toBe(true));
      const note = view.getByText('Sin WebM aquí.');
      expect(button.getAttribute('aria-describedby')).toBe(note.id);
    })();
    cleanup();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    {
      // merges label overrides of the right type only
      const labels = resolveCompositionExportLabels({ png: 'PNG', done: 7 as never });
      expect(labels.png).toBe('PNG');
      expect(labels.done('a.png')).toBe('Saved a.png.');
    }
  });
});

describe('exportWebm with composition v2', () => {
  const timed = {
    version: 2,
    width: 64,
    height: 36,
    durationMs: 400,
    layers: [
      {
        id: 'first',
        type: 'group',
        timing: { startMs: 0, endMs: 200 },
        children: [
          {
            id: 'red',
            type: 'shape',
            shape: 'rectangle',
            frame: { x: 0, y: 0, width: 64, height: 36 },
            fill: { kind: 'solid', color: '#ff0000' },
          },
        ],
      },
      {
        id: 'blue',
        type: 'shape',
        shape: 'rectangle',
        timing: { startMs: 200 },
        frame: { x: 0, y: 0, width: 64, height: 36 },
        fill: { kind: 'solid', color: '#0000ff' },
      },
    ],
  };
  const still = {
    version: 1,
    durationMs: 400,
    tracks: [{ layerId: 'blue', keyframes: [{ timeMs: 0, opacity: 1 }] }],
  };
  it('draws only the layers whose window covers each recorded frame; rejects an invalid v2 composition or group track before recording', async () => {
    // draws only the layers whose window covers each recorded frame
    await (async () => {
      const early = fakeCanvas();
      const first = await exportWebm(timed, still, {
        createCanvas: () => early.canvas,
        Recorder: fakeRecorder().Recorder,
        fps: 10,
        trim: { startMs: 0, endMs: 100 },
        frameClock: immediateFrameClock,
      });
      expect(first.ok).toBe(true);
      expect(early.fills).toContain('#ff0000');
      expect(early.fills).not.toContain('#0000ff');

      const late = fakeCanvas();
      const second = await exportWebm(timed, still, {
        createCanvas: () => late.canvas,
        Recorder: fakeRecorder().Recorder,
        fps: 10,
        trim: { startMs: 250, endMs: 350 },
        frameClock: immediateFrameClock,
      });
      expect(second.ok).toBe(true);
      expect(late.fills).toContain('#0000ff');
      expect(late.fills).not.toContain('#ff0000');
    })();
    cleanup();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    // rejects an invalid v2 composition or group track before recording
    await (async () => {
      const { canvas } = fakeCanvas();
      const { Recorder, instances } = fakeRecorder();
      const badComposition = await exportWebm(
        { ...timed, layers: [{ id: 'g', type: 'group', children: [] }] },
        still,
        { createCanvas: () => canvas, Recorder, frameClock: immediateFrameClock }
      );
      expect(badComposition).toMatchObject({
        ok: false,
        reason: 'invalid',
        errors: [{ path: 'layers[0].children' }],
      });
      const badTrack = await exportWebm(
        timed,
        {
          version: 1,
          durationMs: 400,
          tracks: [{ layerId: 'first', keyframes: [{ timeMs: 0, rotateDeg: 90 }] }],
        },
        { createCanvas: () => canvas, Recorder, frameClock: immediateFrameClock }
      );
      expect(badTrack).toMatchObject({
        ok: false,
        reason: 'invalid',
        errors: [{ path: 'animation.tracks[0].keyframes[0].rotateDeg' }],
      });
      expect(instances).toHaveLength(0);
    })();
  });
});
