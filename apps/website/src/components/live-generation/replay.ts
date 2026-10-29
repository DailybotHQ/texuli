/**
 * A replayed agent stream for `<Player stream>`: an `AsyncIterable<string>`
 * that releases recorded chunks on a timer the page controls (play, pause,
 * one step, a speed read before every chunk) and can stop the way a real
 * connection does: early (`interrupt`, the iterator throws) or at a
 * scheduled drop (`dropAt`). Framework-free and network-free; one replay is
 * read once, and a retry is a new replay.
 */

export type ReplayState = 'idle' | 'playing' | 'paused' | 'done' | 'interrupted';

export interface ReplayOptions {
  /** Milliseconds before the next chunk, read before each one (the speed control). */
  delay: () => number;
  /** Drop the connection once this share of the chunks (0–1) has been sent. */
  dropAt?: number;
  /** Called after every state or count change. */
  onChange?: (replay: Replay) => void;
  /** The timer (tests pass a fake). */
  schedule?: (run: () => void, ms: number) => unknown;
  cancel?: (handle: unknown) => void;
}

export const DROPPED_MESSAGE = 'The connection dropped.';

export class Replay implements AsyncIterable<string> {
  readonly total: number;
  #chunks: readonly string[];
  #options: ReplayOptions;
  #sent = 0;
  #state: ReplayState = 'idle';
  #queue: string[] = [];
  #error: Error | null = null;
  #wake: (() => void) | null = null;
  #timer: unknown = null;
  #read = false;
  #dropAfter: number;

  constructor(chunks: readonly string[], options: ReplayOptions) {
    this.#chunks = chunks;
    this.#options = options;
    this.total = chunks.length;
    this.#dropAfter =
      options.dropAt === undefined
        ? Number.POSITIVE_INFINITY
        : Math.max(1, Math.floor(chunks.length * Math.min(1, Math.max(0, options.dropAt))));
  }

  get state(): ReplayState {
    return this.#state;
  }

  /** Chunks sent so far. */
  get sent(): number {
    return this.#sent;
  }

  get finished(): boolean {
    return this.#state === 'done' || this.#state === 'interrupted';
  }

  play(): void {
    if (this.finished || this.#state === 'playing') return;
    this.#state = 'playing';
    this.#changed();
    this.#tick();
  }

  pause(): void {
    if (this.#state !== 'playing') return;
    this.#clear();
    this.#state = 'paused';
    this.#changed();
  }

  /** Send exactly one chunk, then pause. */
  step(): void {
    if (this.finished) return;
    this.#clear();
    this.#state = 'paused';
    this.#send();
  }

  /** Stop the stream as a dropped connection would: the reader sees an error. */
  interrupt(message = DROPPED_MESSAGE): void {
    if (this.finished) return;
    this.#clear();
    this.#error = new Error(message);
    this.#state = 'interrupted';
    this.#changed();
    this.#notify();
  }

  /** Stop timers without telling the reader (the page is going away). */
  dispose(): void {
    this.#clear();
  }

  #tick(): void {
    if (this.#state !== 'playing') return;
    const schedule = this.#options.schedule ?? ((run, ms) => setTimeout(run, ms));
    this.#timer = schedule(() => {
      this.#timer = null;
      if (this.#state !== 'playing') return;
      this.#send();
      this.#tick();
    }, this.#options.delay());
  }

  #send(): void {
    const next = this.#chunks[this.#sent];
    if (next === undefined) return;
    this.#queue.push(next);
    this.#sent += 1;
    if (this.#sent >= this.#dropAfter && this.#sent < this.total) {
      this.#notify();
      this.interrupt();
      return;
    }
    if (this.#sent >= this.total) {
      this.#clear();
      this.#state = 'done';
    }
    this.#changed();
    this.#notify();
  }

  #clear(): void {
    if (this.#timer !== null) {
      const cancel = this.#options.cancel ?? ((handle) => clearTimeout(handle as number));
      cancel(this.#timer);
      this.#timer = null;
    }
  }

  #changed(): void {
    this.#options.onChange?.(this);
  }

  #notify(): void {
    const wake = this.#wake;
    this.#wake = null;
    wake?.();
  }

  async *[Symbol.asyncIterator](): AsyncIterator<string> {
    if (this.#read) throw new Error('A replay is read once; start a new one.');
    this.#read = true;
    while (true) {
      const next = this.#queue.shift();
      if (next !== undefined) {
        yield next;
        continue;
      }
      if (this.#error) throw this.#error;
      if (this.#state === 'done') return;
      await new Promise<void>((resolve) => {
        this.#wake = resolve;
      });
    }
  }
}
