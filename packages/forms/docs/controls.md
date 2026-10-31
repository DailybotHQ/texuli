# `@texuli/forms/controls`

> **Status: in development (pre-1.0).** New in `0.10.0`; `@texuli/forms`
> is on npm from `0.8.0`.

The static control registry of `SchemaForm` (G119). `SchemaForm` loads the
controls of date, time, datetime, slider, tags, file, color and radio
fields, and the step navigation of multi-step forms, the first time a form
uses them, so a form that never paints them never ships them or their CSS.
On the server a lazy control renders as a placeholder of about its size.
A host that wants every control in the server HTML passes this registry:

```svelte
<script lang="ts">
import { SchemaForm } from '@texuli/forms';
import { SCHEMA_FORM_CONTROLS } from '@texuli/forms/controls';
</script>

<SchemaForm {form} controls={SCHEMA_FORM_CONTROLS} />
```

Importing this subpath puts every control and its CSS in the importing
chunk; use it where server rendering matters more than the first-load size.

## Exports

| Export | What it is |
| --- | --- |
| `SCHEMA_FORM_CONTROLS` | Every per-type control and `progress` (the step navigation), as `SchemaFormControls` |
| `DateControl`, `TimeControl`, `DateTimeControl` | `DatePicker`, `TimeField`, and both together for datetime |
| `SliderControl`, `TagsControl`, `FileControl`, `ColorControl`, `RadioControl` | `Slider`, `TagsInput`, `FileUpload`, `ColorPicker` and `RadioGroup` |
| `ProgressControl` | The texuli `Stepper` of a multi-step form (`SchemaFormProgressProps`) |
| `LAZY_CONTROL_TYPES`, `LazyControlType`, `isLazyControlType` | The field types loaded per type |
| `SchemaFormControl`, `SchemaFormControlProps` | A control and what it receives: `field`, `value`, `attrs` (the Field's `id`, `aria-describedby`, `aria-invalid`, `aria-required`, `disabled`), `required`, `disabled`, `readOnly`, `labels`, `files`, `onValue`, `onFiles` |
| `SchemaFormControls` | Controls by type, plus `progress`; any subset may be passed as `controls` |
| `SchemaFormProgressProps` | `steps`, `current`, `label`, `onStepClick` |

A control in `controls` wins over the lazy one, so a host can replace one
type (`controls={{ date: MyDateControl }}`) as long as its control puts
`attrs` on the focusable element.

Tests: `packages/forms/tests/bundle-graph.test.ts` (the initial graph of a
text, select and checkbox form has none of these controls or their CSS;
with the registry it has them all) and `packages/forms/tests/ssr.test.ts`
(placeholders by default, controls with the registry).
