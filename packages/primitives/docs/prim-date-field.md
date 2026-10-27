# DateField and TimeField

`@texuli/primitives/date-field` exports headless `DateField.Root` and
`TimeField.Root` controls. Date segments follow the order reported by
`Intl.DateTimeFormat` for `locale`; date values are canonical `YYYY-MM-DD`
strings and time values are canonical 24-hour `HH:mm` strings. Both roots
support `bind:value`, a group label, disabled/required state, and an optional
named hidden control for form submission.

```svelte
<script lang="ts">
import { DateField, TimeField } from '@texuli/primitives/date-field';

let startDate = $state<string | null>('2026-03-15');
let startTime = $state<string | null>('17:05');
</script>

<DateField.Root bind:value={startDate} locale="en-GB" label="Start date" name="startDate" />
<TimeField.Root bind:value={startTime} locale="en-GB" label="Start time" name="startTime" />
```

The DateField rejects impossible dates and values outside its optional ISO
`min`/`max` bounds. TimeField accepts `hourCycle={12 | 24}` (otherwise it
uses the locale's cycle) and a `minuteStep`; values remain 24-hour strings.
Each segment is a native spinbutton for keyboard and touch accessibility.

Validation: `pnpm vitest run packages/primitives/tests/models.test.ts packages/primitives/tests/forms.test.ts`,
`TEXULI_E2E_PORT=4790 pnpm exec playwright test tests/behavior/scenarios/date-field.spec.ts`,
and `pnpm --filter @texuli/primitives typecheck`.
