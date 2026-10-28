/**
 * Event handler composition for primitive parts.
 *
 * A part that binds its own handler on an element (a click that selects, a
 * keydown that moves focus) also accepts the same handler from the consumer.
 * The consumer's handler never replaces the part's: it runs first, and calling
 * `event.preventDefault()` in it skips the part's behavior (the same rule as
 * `composeChildProps`). Events that cannot be prevented (`input`, `focus`,
 * `blur`) always run both.
 */

/**
 * Run `consumer` first, then `own` unless the consumer prevented the default
 * action. `consumer` is the handler prop as received (any element handler, or
 * nothing); a value that is not a function is ignored.
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

/**
 * Run `consumer` first, then always `own`: for handlers whose part behavior is
 * bookkeeping that must not be skipped (ending a drag, tracking focus, reading
 * the caret, drag-and-drop state, where consumers call `preventDefault()` for
 * their own reasons).
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
