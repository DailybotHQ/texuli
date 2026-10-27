// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  type ExportCanvas,
  exportQueue,
  type RecorderConstructor,
  type RecorderLike,
} from '../src/export/index.ts';

const composition = {
  version: 1,
  width: 32,
  height: 24,
  layers: [],
};

describe('exportQueue', () => {
  it('exports a batch in order and emits progress receipts without request data, and 4 related cases', async () => {
    // exports a batch in order and emits progress receipts without request data
    await (async () => {
      const progress: Array<{ completed: number; total: number; current: number; status: string }> =
        [];
      const result = await exportQueue(
        [
          { format: 'svg', input: composition, options: { filename: 'first-poster' } },
          { format: 'svg', input: composition, options: { filename: 'second-poster' } },
        ],
        {
          now: (() => {
            let time = 100;
            return () => time++;
          })(),
          onProgress: (event) => {
            progress.push({
              completed: event.completed,
              total: event.total,
              current: event.current?.progress ?? 0,
              status: event.current?.status ?? 'idle',
            });
          },
        }
      );

      expect(
        result.receipts.map(({ id, format, status, progress: value }) => ({
          id,
          format,
          status,
          value,
        }))
      ).toEqual([
        { id: 'export-1', format: 'svg', status: 'succeeded', value: 1 },
        { id: 'export-2', format: 'svg', status: 'succeeded', value: 1 },
      ]);
      expect(result.results.map((item) => item?.ok)).toEqual([true, true]);
      expect(result.receipts.every((receipt) => receipt.durationMs === 1)).toBe(true);
      expect(progress.at(-1)).toEqual({ completed: 2, total: 2, current: 1, status: 'succeeded' });
      expect(JSON.stringify(result.receipts)).not.toContain('first-poster');
      expect(JSON.stringify(result.receipts)).not.toContain('layers');
    })();
    // records an invalid item and continues with later jobs
    await (async () => {
      const result = await exportQueue([
        { format: 'svg', input: null },
        { format: 'svg', input: composition },
      ]);

      expect(result.receipts.map(({ status }) => status)).toEqual(['failed', 'succeeded']);
      expect(result.results.map((item) => item?.ok)).toEqual([false, true]);
    })();
    // marks queued work cancelled when the caller signal is already aborted
    await (async () => {
      const controller = new AbortController();
      controller.abort();

      const result = await exportQueue(
        [
          { format: 'svg', input: composition },
          { format: 'svg', input: composition },
        ],
        { signal: controller.signal }
      );

      expect(result.receipts.map(({ status, progress: value }) => ({ status, value }))).toEqual([
        { status: 'cancelled', value: 0 },
        { status: 'cancelled', value: 0 },
      ]);
      expect(result.results).toEqual([null, null]);
    })();
    // aborts the active queue item and cancels the remaining items
    await (async () => {
      const controller = new AbortController();
      const result = await exportQueue(
        [
          { format: 'svg', input: composition },
          { format: 'svg', input: composition },
        ],
        {
          signal: controller.signal,
          onProgress: (event) => {
            if (event.current?.status === 'running') controller.abort();
          },
        }
      );

      expect(result.receipts.map(({ status }) => status)).toEqual(['cancelled', 'cancelled']);
      expect(result.results).toEqual([null, null]);
    })();
    // uses WebM frame progress in the per-item receipt
    await (async () => {
      class Recorder implements RecorderLike {
        static isTypeSupported() {
          return true;
        }
        readonly mimeType = 'video/webm;codecs=vp8';
        readonly videoBitsPerSecond = 0;
        ondataavailable: RecorderLike['ondataavailable'] = null;
        onstop: RecorderLike['onstop'] = null;
        onerror: RecorderLike['onerror'] = null;
        start() {}
        stop() {
          this.ondataavailable?.({ data: new Blob(['clip'], { type: 'video/webm' }) });
          queueMicrotask(() => this.onstop?.());
        }
      }
      const context = new Proxy(
        { globalAlpha: 1 },
        {
          has: () => true,
          get: (target, key) => (key in target ? target[key as keyof typeof target] : () => {}),
          set: (target, key, value) => {
            target[key as keyof typeof target] = value as never;
            return true;
          },
        }
      );
      const track = { requestFrame() {}, stop() {} };
      const canvas = {
        width: 0,
        height: 0,
        getContext: () => context,
        captureStream: () => ({ getVideoTracks: () => [track], getTracks: () => [track] }),
      } as unknown as ExportCanvas;
      const progress: number[] = [];
      const webmComposition = {
        ...composition,
        layers: [
          {
            id: 'shape',
            type: 'shape',
            shape: 'rectangle',
            frame: { x: 0, y: 0, width: 32, height: 24 },
            fill: { kind: 'solid', color: '#334455' },
          },
        ],
      };

      const result = await exportQueue(
        [
          {
            format: 'webm',
            composition: webmComposition,
            animation: {
              version: 1,
              durationMs: 200,
              tracks: [{ layerId: 'shape', keyframes: [{ timeMs: 0 }, { timeMs: 200 }] }],
            },
            options: {
              fps: 10,
              Recorder: Recorder as unknown as RecorderConstructor,
              createCanvas: () => canvas,
              frameClock: { now: () => 0, waitUntil: async () => {} },
            },
          },
        ],
        { onProgress: (event) => progress.push(event.current?.progress ?? 0) }
      );

      expect(result.results[0]?.ok).toBe(true);
      expect(result.receipts[0]).toMatchObject({
        format: 'webm',
        status: 'succeeded',
        progress: 1,
      });
      expect(progress).toEqual([0, 0, 1 / 3, 2 / 3, 1, 1, 1]);
    })();
  });
});
