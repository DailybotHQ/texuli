import {
  createInfiniteLoader,
  createVirtualList,
  nextVirtualListIndex,
} from '@texuli/data/virtual-list';
import { describe, expect, it, vi } from 'vitest';

describe('variable-height virtual list', () => {
  it('windows a large collection with estimated and measured heights', () => {
    const list = createVirtualList({ count: 100_000, estimateSize: 40, overscan: 1 });
    expect(list.measure(100, 80)).toBe(true);
    expect(list.measure(101, 20)).toBe(true);

    const window = list.window(4_000, 80);
    expect(list.totalSize).toBe(4_000_020);
    expect(window.items.map(({ index, start, size }) => [index, start, size])).toEqual([
      [99, 3_960, 40],
      [100, 4_000, 80],
      [101, 4_080, 20],
    ]);
  });

  it('finds exact row boundaries and clamps offsets', () => {
    const list = createVirtualList({ count: 3, estimateSize: 10 });
    list.measure(0, 20);
    list.measure(1, 5);

    expect([list.offsetOf(0), list.offsetOf(1), list.offsetOf(2), list.offsetOf(3)]).toEqual([
      0, 20, 25, 35,
    ]);
    expect([list.indexAt(-20), list.indexAt(19), list.indexAt(20), list.indexAt(35)]).toEqual([
      0, 0, 1, 2,
    ]);
    expect(list.offsetOf(100)).toBe(35);
  });

  it('normalizes invalid counts, estimates, viewport values and measurements safely', () => {
    const list = createVirtualList({ count: Number.NaN, estimateSize: 0 });
    expect(list.count).toBe(0);
    expect(list.totalSize).toBe(0);
    expect(list.window(0, 100).items).toEqual([]);

    list.resize(2.8);
    expect(list.count).toBe(2);
    expect(list.totalSize).toBe(2);
    expect(list.measure(-1, 20)).toBe(false);
    expect(list.measure(0, 0)).toBe(false);
    expect(list.measure(2, 20)).toBe(false);
    expect(list.window(0, Number.NaN).items).toEqual([]);
  });

  it('drops measurements when the collection shrinks', () => {
    const list = createVirtualList({ count: 3, estimateSize: 10 });
    list.measure(2, 40);
    list.resize(2);
    expect(list.totalSize).toBe(20);
    expect(list.sizeOf(2)).toBe(0);
    list.resize(4);
    expect(list.totalSize).toBe(40);
    expect(list.offsetOf(3)).toBe(30);
  });

  it('keeps the rendered range bounded and reports the full virtual size', () => {
    const list = createVirtualList({ count: 5000, estimateSize: 24, overscan: 2 });
    const window = list.window(24_000, 120);
    expect(window.totalSize).toBe(120_000);
    expect(window.items.length).toBeLessThanOrEqual(10);
    expect(window.items[0]?.index).toBe(998);
    expect(window.items.at(-1)?.index).toBe(1006);
  });
});

describe('virtual list keyboard navigation', () => {
  it('supports vertical navigation, Home, End and page movement', () => {
    const options = { count: 20, pageSize: 5 };
    expect(nextVirtualListIndex(2, 'ArrowDown', options)).toBe(3);
    expect(nextVirtualListIndex(0, 'ArrowUp', options)).toBe(0);
    expect(nextVirtualListIndex(3, 'PageDown', options)).toBe(8);
    expect(nextVirtualListIndex(3, 'PageUp', options)).toBe(0);
    expect(nextVirtualListIndex(3, 'Home', options)).toBe(0);
    expect(nextVirtualListIndex(3, 'End', options)).toBe(19);
    expect(nextVirtualListIndex(3, 'Enter', options)).toBeNull();
  });

  it('reverses horizontal arrow movement in RTL and optionally wraps', () => {
    const options = { count: 3, orientation: 'horizontal' as const, direction: 'rtl' as const };
    expect(nextVirtualListIndex(1, 'ArrowRight', options)).toBe(0);
    expect(nextVirtualListIndex(1, 'ArrowLeft', options)).toBe(2);
    expect(nextVirtualListIndex(0, 'ArrowRight', { ...options, loop: true })).toBe(2);
    expect(
      nextVirtualListIndex(0, 'PageUp', {
        ...options,
        loop: true,
        pageSize: 10,
      })
    ).toBe(2);
    expect(nextVirtualListIndex(1, 'ArrowDown', options)).toBeNull();
    expect(nextVirtualListIndex(0, 'Home', { count: 0 })).toBeNull();
  });
});

describe('infinite list loading', () => {
  it('loads at the threshold and coalesces concurrent range checks', async () => {
    let count = 10;
    let finish: (() => void) | undefined;
    const loadMore = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          finish = () => {
            count += 5;
            resolve();
          };
        })
    );
    const loader = createInfiniteLoader({ getItemCount: () => count, loadMore, threshold: 3 });

    await loader.check(6);
    expect(loader.status).toBe('idle');
    const first = loader.check(7);
    const second = loader.check(8);
    expect(loader.status).toBe('loading');
    expect(loadMore).toHaveBeenCalledTimes(1);
    finish?.();
    await Promise.all([first, second]);
    expect(count).toBe(15);
    expect(loader.status).toBe('idle');
  });

  it('does not load outside the threshold and marks an exhausted list', async () => {
    const loadMore = vi.fn().mockResolvedValue(undefined);
    let more = true;
    const loader = createInfiniteLoader({
      getItemCount: () => 10,
      loadMore,
      threshold: 2,
      hasMore: () => more,
    });
    await loader.check(7);
    expect(loadMore).not.toHaveBeenCalled();
    await loader.check(8);
    expect(loadMore).toHaveBeenCalledTimes(1);
    more = false;
    await loader.check(10);
    expect(loader.status).toBe('exhausted');
    expect(loadMore).toHaveBeenCalledTimes(1);
  });

  it('exposes errors and retries after resetError', async () => {
    const failure = new Error('network unavailable');
    const loadMore = vi.fn().mockRejectedValueOnce(failure).mockResolvedValueOnce(undefined);
    const loader = createInfiniteLoader({ getItemCount: () => 5, loadMore, threshold: 1 });

    await loader.check(4);
    expect(loader.status).toBe('error');
    expect(loader.error).toBe(failure);
    await loader.check(5);
    expect(loadMore).toHaveBeenCalledTimes(1);
    loader.resetError();
    await loader.check(5);
    expect(loader.status).toBe('idle');
    expect(loader.error).toBeUndefined();
    expect(loadMore).toHaveBeenCalledTimes(2);
  });
});
