/**
 * Caller handlers on elements a component also listens on. The caller's
 * handler never replaces the component's: it runs first. The same rules as
 * `composeHandlers` and `chainHandlers` in `@texuli/primitives` (internal):
 *
 * - `composeHandlers`: the component's own handler runs unless the caller
 *   called `event.preventDefault()` (a key or a click the caller takes over);
 * - `chainHandlers`: the component's own handler always runs (bookkeeping
 *   that must not be skipped: focus tracking, drag state, value sync).
 */
export function composeHandlers<E extends Event>(
  consumer: unknown,
  own: (event: E) => unknown
): (event: E) => void {
  return (event: E) => {
    if (typeof consumer === 'function') consumer(event);
    if (!event.defaultPrevented) own(event);
  };
}

export function chainHandlers<E extends Event>(
  consumer: unknown,
  own: (event: E) => unknown
): (event: E) => void {
  return (event: E) => {
    if (typeof consumer === 'function') consumer(event);
    own(event);
  };
}
