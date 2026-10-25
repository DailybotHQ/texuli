export interface VirtualRow {
  index: number;
  key: string;
  start: number;
  size: number;
  measured: boolean;
}

export interface VirtualWindow {
  totalSize: number;
  items: VirtualRow[];
}

/**
 * Variable-height list offsets for chat history. Measurements are kept by row
 * key, so prepending older rows keeps every height with its own row instead of
 * shifting it onto whichever row now holds the same index.
 */
export class MessageVirtualWindow {
  private count: number;
  private readonly estimate: number;
  private readonly heights = new Map<string, number>();
  private keys: string[] = [];
  private keySource: readonly string[] | undefined;
  private indexByKey = new Map<string, number>();
  private tree: number[] = [];

  constructor(count: number, estimate = 112) {
    this.count = 0;
    this.estimate = Math.max(1, estimate);
    this.resize(count);
  }

  /** Sets the row count; `keys` names each row (rows without a key fall back to their index). */
  resize(count: number, keys?: readonly string[]): void {
    const next = Math.max(0, Math.floor(count));
    if (keys !== undefined && keys === this.keySource && next === this.count) return;
    this.count = next;
    this.keySource = keys;
    this.keys = Array.from({ length: next }, (_, index) => keys?.[index] ?? `#${index}`);
    this.indexByKey = new Map(this.keys.map((key, index) => [key, index]));
    for (const key of this.heights.keys()) if (!this.indexByKey.has(key)) this.heights.delete(key);
    this.rebuild();
  }

  measure(index: number, height: number): boolean {
    if (
      !Number.isInteger(index) ||
      index < 0 ||
      index >= this.count ||
      !Number.isFinite(height) ||
      height <= 0
    )
      return false;
    const key = this.keys[index] as string;
    const previous = this.heights.get(key) ?? this.estimate;
    if (previous === height) return false;
    this.heights.set(key, height);
    this.add(index, height - previous);
    return true;
  }

  /** Measures the row named `key`; returns false when no such row exists. */
  measureKey(key: string, height: number): boolean {
    return this.measure(this.indexOfKey(key), height);
  }

  /** The current index of the row named `key`, or -1. */
  indexOfKey(key: string): number {
    return this.indexByKey.get(key) ?? -1;
  }

  offsetOf(index: number): number {
    const end = Math.min(this.count, Math.max(0, Math.floor(index)));
    return end * this.estimate + this.prefixDelta(end);
  }

  window(scrollOffset: number, viewportSize: number, overscan = 5): VirtualWindow {
    const totalSize = this.offsetOf(this.count);
    if (!this.count || !Number.isFinite(viewportSize) || viewportSize <= 0)
      return { totalSize, items: [] };
    const startOffset = Math.max(0, Number.isFinite(scrollOffset) ? scrollOffset : 0);
    const first = this.indexAt(startOffset);
    const last = this.indexAt(Math.max(startOffset, startOffset + viewportSize - 0.01));
    const from = Math.max(0, first - Math.max(0, Math.floor(overscan)));
    const to = Math.min(this.count, last + 1 + Math.max(0, Math.floor(overscan)));
    const items: VirtualRow[] = [];
    for (let index = from; index < to; index += 1) {
      const key = this.keys[index] as string;
      const height = this.heights.get(key);
      items.push({
        index,
        key,
        start: this.offsetOf(index),
        size: height ?? this.estimate,
        measured: height !== undefined,
      });
    }
    return { totalSize, items };
  }

  private indexAt(offset: number): number {
    if (!this.count) return 0;
    const target = Math.min(Math.max(0, offset), Math.max(0, this.offsetOf(this.count) - 0.01));
    let low = 0;
    let high = this.count;
    while (low < high) {
      const middle = Math.floor((low + high) / 2);
      if (this.offsetOf(middle + 1) <= target) low = middle + 1;
      else high = middle;
    }
    return Math.min(low, this.count - 1);
  }

  private prefixDelta(end: number): number {
    let sum = 0;
    for (let cursor = end; cursor > 0; cursor -= cursor & -cursor) sum += this.tree[cursor] ?? 0;
    return sum;
  }

  private add(index: number, delta: number): void {
    for (let cursor = index + 1; cursor <= this.count; cursor += cursor & -cursor) {
      this.tree[cursor] = (this.tree[cursor] ?? 0) + delta;
    }
  }

  private rebuild(): void {
    this.tree = new Array<number>(this.count + 1).fill(0);
    for (let index = 0; index < this.count; index += 1) {
      const height = this.heights.get(this.keys[index] as string);
      if (height !== undefined) this.add(index, height - this.estimate);
    }
  }
}
