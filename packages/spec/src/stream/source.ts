/**
 * A push handle for a blueprint stream (ADR-014): the host writes text as it
 * arrives (an agent's tool deltas, server-sent events) and a reader such as
 * `<Player stream={handle}>` iterates it. One reader per handle. `abort()`
 * makes the reader's iteration throw a {@link BlueprintStreamAbortError};
 * chunks written before it are still read first.
 */

export interface BlueprintStreamHandle extends AsyncIterable<string> {
  /** Queue the next chunk. Ignored after `end()` or `abort()`. */
  write(text: string): void;
  /** The stream is complete: the reader finishes after the queued chunks. */
  end(): void;
  /** The stream stopped early: the reader throws after the queued chunks. */
  abort(reason?: string): void;
  /** `true` after `end()` or `abort()`. */
  readonly closed: boolean;
}

/** What a reader of an aborted {@link BlueprintStreamHandle} throws. */
export class BlueprintStreamAbortError extends Error {
  override readonly name = 'AbortError';
}

export function createBlueprintStream(): BlueprintStreamHandle {
  const queue: string[] = [];
  let state: 'open' | 'ended' | 'aborted' = 'open';
  let reason = 'The stream was aborted.';
  let wake: (() => void) | null = null;

  const notify = () => {
    const resume = wake;
    wake = null;
    resume?.();
  };

  return {
    write(text) {
      if (state !== 'open' || typeof text !== 'string' || text === '') return;
      queue.push(text);
      notify();
    },
    end() {
      if (state !== 'open') return;
      state = 'ended';
      notify();
    },
    abort(message) {
      if (state !== 'open') return;
      state = 'aborted';
      if (typeof message === 'string' && message !== '') reason = message;
      notify();
    },
    get closed() {
      return state !== 'open';
    },
    [Symbol.asyncIterator](): AsyncIterator<string> {
      return {
        async next(): Promise<IteratorResult<string>> {
          while (queue.length === 0 && state === 'open') {
            await new Promise<void>((resolve) => {
              wake = resolve;
            });
          }
          const chunk = queue.shift();
          if (chunk !== undefined) return { value: chunk, done: false };
          if (state === 'aborted') throw new BlueprintStreamAbortError(reason);
          return { value: undefined, done: true };
        },
        async return(): Promise<IteratorResult<string>> {
          // The reader stopped listening: drop what is queued.
          queue.length = 0;
          if (state === 'open') state = 'ended';
          notify();
          return { value: undefined, done: true };
        },
      };
    },
  };
}
