# Native form bridge

`createFormBridge(document, options)` creates a visually hidden native text
input for a custom control. Add the input to the custom control's form tree,
then keep it synchronized with the custom value. It uses `type="text"` rather
than `type="hidden"` because hidden inputs do not participate in required or
custom validity checks.

```ts
import { createFormBridge } from '@texuli/core';

const bridge = createFormBridge(trigger.ownerDocument, {
  name: 'timezone',
  value: selectedTimezone,
  defaultValue: 'UTC',
  required: true,
  disabled: false,
  form: 'profile-form',
  focusTarget: trigger,
  onReset: (value) => setSelectedTimezone(value),
});

container.append(bridge.input);
bridge.setValue(nextTimezone);
bridge.setValidity(isAllowed(nextTimezone) ? '' : 'Choose an available timezone.');

// In the component's teardown:
bridge.dispose();
```

## Behavior

- `name`, `value`, `required`, `disabled` and the optional `form` id use native
  input semantics. A disabled input is omitted from `FormData` and constraint
  validation. An enabled required input with an empty value is invalid.
- `defaultValue` is the value restored by the browser's native form reset; it
  defaults to the initial `value`, which defaults to an empty string.
- `onReset` fires after the owning form's reset event completes, unless another
  listener canceled that reset. It receives the reset value so the custom
  control can update its own state. The form association is read from the input,
  so an explicit `form` id works for a form outside the widget subtree.
- `setValue` updates the submitted value without changing `defaultValue`.
  `setValidity('')` clears a custom error; any other message participates in
  native constraint validation. On invalid input, `focusTarget` receives focus
  after the browser finishes its invalid-field processing.
- The helper takes its `Document` explicitly and does not read browser globals
  during import. The proxy is hidden from assistive technology; `focusTarget`
  is required so invalid submission returns focus to the visible custom
  control. Dispose it when the control unmounts to remove its document listener
  and backing input.
