/**
 * Caller handlers on elements a component also listens on. The caller's
 * handler never replaces the component's: it runs first, then the
 * component's own handler always runs (the bookkeeping must not be skipped).
 * Same rule as `chainHandlers` in `@texuli/primitives` (internal).
 */
export function chainHandlers<E extends Event>(
  consumer: unknown,
  own: (event: E) => unknown
): (event: E) => void {
  return (event: E) => {
    if (typeof consumer === 'function') consumer(event);
    own(event);
  };
}
