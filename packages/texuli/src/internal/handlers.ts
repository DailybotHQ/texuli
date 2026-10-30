/**
 * Caller handlers on elements a component also listens on. The caller's
 * handler never replaces the component's: it runs first. The same rules as
 * `composeHandlers` and `chainHandlers` in `@texuli/primitives`. Public from
 * `texuli` and `texuli/cx`, for hosts that build their own parts:
 *
 * - `composeHandlers`: the component's own handler runs unless the caller
 *   called `event.preventDefault()` (a key or a click the caller takes over);
 * - `chainHandlers`: the component's own handler always runs (bookkeeping
 *   that must not be skipped: focus tracking, drag state, value sync).
 */
/** Run `consumer` first, then `own` unless the consumer called `event.preventDefault()`. */
export function composeHandlers<E extends Event>(
  consumer: unknown,
  own: (event: E) => unknown
): (event: E) => void {
  return (event: E) => {
    if (typeof consumer === 'function') consumer(event);
    if (!event.defaultPrevented) own(event);
  };
}

/** Run `consumer` first, then always `own` (bookkeeping that must not be skipped). */
export function chainHandlers<E extends Event>(
  consumer: unknown,
  own: (event: E) => unknown
): (event: E) => void {
  return (event: E) => {
    if (typeof consumer === 'function') consumer(event);
    own(event);
  };
}
