/**
 * Options for a state value that may be controlled by its owner.
 *
 * Supplying `value` makes the state controlled for this helper's lifetime.
 * The getter is read each time so rune-backed props remain reactive. Without
 * it, `defaultValue` initializes local state once.
 */
export interface ControllableStateOptions<T> {
  /** Current owner-provided value. Omit this getter for uncontrolled state. */
  value?: () => T;
  /** Initial value used only when `value` is omitted. */
  defaultValue: T;
  /** Called when a requested value differs from the current value. */
  onChange?: (value: T) => void;
  /** Called only when the owner explicitly marks a change as complete. */
  onChangeComplete?: (value: T) => void;
}

/**
 * A rune-friendly view of controlled or local state.
 *
 * `value` reads the owner's getter when controlled, or the local value
 * otherwise. `setValue` and `update` request changes; controlled state is
 * never mutated locally. Call `complete` at the interaction boundary (for
 * example pointer-up or blur) to invoke `onChangeComplete`. This helper does
 * not attach listeners, schedule callbacks, or access browser globals.
 */
export interface ControllableState<T> {
  /** The current controlled or uncontrolled value. */
  readonly value: T;
  /** Request an explicit value. Equal values are ignored using `Object.is`. */
  setValue(value: T): void;
  /** Request a value derived from the latest current value. */
  update(updater: (current: T) => T): void;
  /** Signal that the caller's interaction is complete. */
  complete(): void;
}

/**
 * Creates framework-free state for props that support controlled (`bind:`)
 * and uncontrolled (`defaultValue`) use.
 *
 * The `value` getter is read at access time, so a Svelte rune-backed prop can
 * be passed without taking a stale snapshot. Controlledness is fixed when the
 * helper is created: provide or omit `value` consistently for its lifetime.
 *
 * `onChange` runs synchronously only when a new value is requested. In
 * controlled mode the owner remains the source of truth and must update its
 * value in response. `onChangeComplete` runs only when the caller invokes
 * `complete`, and receives the then-current value.
 */
export function createControllableState<T>(
  options: ControllableStateOptions<T>
): ControllableState<T> {
  let localValue = options.defaultValue;
  const controlledValue = options.value;
  const isControlled = controlledValue !== undefined;

  const read = (): T => (controlledValue ? controlledValue() : localValue);

  const request = (next: T): void => {
    if (Object.is(read(), next)) return;
    if (!isControlled) localValue = next;
    options.onChange?.(next);
  };

  return {
    get value(): T {
      return read();
    },
    setValue(value: T): void {
      request(value);
    },
    update(updater: (current: T) => T): void {
      request(updater(read()));
    },
    complete(): void {
      options.onChangeComplete?.(read());
    },
  };
}
