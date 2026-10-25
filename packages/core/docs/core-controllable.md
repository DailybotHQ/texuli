# Controllable state

`createControllableState` gives framework-free code one interface for state
that may be owned by a parent or initialized locally. It lives in
`@texuli/core`; it does not import Svelte or access browser globals.

```ts
import { createControllableState } from '@texuli/core';

const state = createControllableState({
  value: () => props.open,
  defaultValue: false,
  onChange: (next) => props.onOpenChange?.(next),
  onChangeComplete: (next) => props.onOpenChangeComplete?.(next),
});

const open = $derived(state.value);
```

The getter is read each time `state.value` is accessed, so a rune-backed prop
does not become a stale snapshot. An uncontrolled caller omits `value`:

```ts
const state = createControllableState({ defaultValue: false });
state.setValue(true);
state.update((current) => !current);
```

## Contract

- **Controlled mode:** supplying a `value` getter makes the owner the source of
  truth. `setValue` and `update` call `onChange` for a different requested
  value, but do not mutate `state.value`. The owner must apply the callback's
  value for the next read to change.
- **Uncontrolled mode:** omitting `value` initializes local state from
  `defaultValue`. A changed request updates local state and calls `onChange`.
- **Equality:** `Object.is` suppresses no-op change callbacks.
- **Updates:** `update` receives the latest value and computes a requested
  value. Use `setValue` for explicit values, including functions.
- **Completion:** `complete()` explicitly calls `onChangeComplete` with the
  then-current value. The helper does not infer pointer-up, blur, keyboard
  commit, or another interaction boundary; the component decides when to call
  it.
- **Mode lifetime:** controlledness is fixed when the helper is created. Keep
  passing or omitting `value` consistently; create a new helper to change
  modes.
- **Callback errors:** callbacks run synchronously and exceptions propagate to
  the caller. An uncontrolled value is updated before `onChange` runs.

For a slider, call `setValue` while the thumb moves and call `complete` on the
chosen interaction boundary. For a text field, `setValue` can run on each
input and `complete` on blur or Enter. This utility stores no interaction or
DOM state, so it is also usable in server-rendered and non-Svelte code.

Behavior is covered at the public barrel in
`packages/core/tests/controllable.test.ts`.
