// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { clearLazyChunk, clearLazyChunks, hasLazyChunk, lazyChunk } from '../src/lazy/index.ts';

describe('lazyChunk', () => {
  it('shares one promise per key and retries after failure', async () => {
    clearLazyChunks();
    let calls = 0;
    const load = () => {
      calls += 1;
      return Promise.resolve({ n: calls });
    };
    const a = lazyChunk('demo', load);
    const b = lazyChunk('demo', load);
    expect(a).toBe(b);
    expect(await a).toEqual({ n: 1 });
    expect(calls).toBe(1);
    expect(hasLazyChunk('demo')).toBe(true);

    clearLazyChunk('demo');
    expect(hasLazyChunk('demo')).toBe(false);

    let failOnce = true;
    const flaky = () => {
      if (failOnce) {
        failOnce = false;
        return Promise.reject(new Error('boom'));
      }
      return Promise.resolve('ok');
    };
    await expect(lazyChunk('flaky', flaky)).rejects.toThrow('boom');
    expect(hasLazyChunk('flaky')).toBe(false);
    await expect(lazyChunk('flaky', flaky)).resolves.toBe('ok');
  });
});
