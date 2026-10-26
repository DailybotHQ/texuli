/**
 * The client track library (T-35): a typed, sanitized, queueing front
 * door for the event catalog. Disabled analytics is a silent no-op — no
 * queue, no console noise, no window.umami touch. When enabled but the
 * script has not signaled readiness yet, events queue in order and flush
 * on the loader's `tx-umami-ready` signal; once `window.umami` exists the
 * queue is bypassed. Every payload passes `sanitizeEventData` before it
 * is queued or sent — sanitize-then-queue, never queue-then-sanitize.
 *
 * Failures are swallowed by design: analytics must never break the page
 * or log in production.
 */

import { type ClientEventName, type EventPayloads, sanitizeEventData } from './analytics.ts';
import { ANALYTICS } from './constances.ts';

/** Dispatched by public/umami-loader.js when the Umami script has loaded. */
export const UMAMI_READY_EVENT = 'tx-umami-ready';

interface QueuedEvent {
  name: ClientEventName;
  data: Record<string, string | number | boolean> | undefined;
}

let queue: QueuedEvent[] = [];

function umami(): { track: (name: string, data?: QueuedEvent['data']) => void } | undefined {
  return (globalThis as { umami?: { track: (name: string, data?: QueuedEvent['data']) => void } })
    .umami;
}

function emit(event: QueuedEvent): void {
  try {
    umami()?.track(event.name, event.data);
  } catch {
    // Analytics never breaks the page and never logs in production.
  }
}

function flush(): void {
  const pending = queue;
  queue = [];
  for (const event of pending) emit(event);
}

if (typeof document !== 'undefined') {
  document.addEventListener(UMAMI_READY_EVENT, flush, { once: true });
}

/**
 * Track one catalog event. No-op when analytics is disabled; queued until
 * the script signals readiness; sanitized before it is stored or sent.
 * A payload whose every key is denied still sends the event name — the
 * name itself is not PII — with no data attached.
 */
export function track<E extends ClientEventName>(eventName: E, data?: EventPayloads[E]): void {
  if (!ANALYTICS.umami.enabled) return;

  const clean = sanitizeEventData(data as Record<string, string | number | boolean> | undefined);
  const event: QueuedEvent = { name: eventName, data: clean };
  if (umami()) {
    emit(event);
    return;
  }
  queue.push(event);
}

/**
 * Once-per-instance guard: the returned function forwards its first call
 * to `track` and drops the rest. A demo's controls fire on every change;
 * the catalog's open event wants the first interaction only.
 */
export function oncePerInstance<E extends ClientEventName>(
  eventName: E
): (data?: EventPayloads[E]) => void {
  let done = false;
  return (data) => {
    if (done) return;
    done = true;
    track(eventName, data);
  };
}

/** Test seam: drop queued events and reset the module's queue state. */
export function resetTrackQueueForTests(): void {
  queue = [];
}
