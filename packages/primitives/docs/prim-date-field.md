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
`min`/`max` bounds. `onInvalid(text, reason)` reports a refused entry once
it is complete (a month, a day and a four-digit year): `invalid` for a date
that does not exist (`2/30/2026`) and `out-of-range` outside `min`/`max`.
`text` is the segments in locale order; the segments carry
`aria-invalid="true"` until the entry is fixed. `onValueChange` (and
`bind:value`) report a date only once the year has four digits: typing
`2` on the way to `2026` reports `null` (an incomplete entry), never
`0002-…`; a year before 1000 is typed with its zeros (`0999`).

Both roots take `inputId` (the first segment's id, so a `<label for>` or a
Field focuses it); an `aria-describedby` or `aria-invalid` you pass reaches
every segment as well as the group, and `bind:ref` is the group.

TimeField accepts `hourCycle={12 | 24}` (otherwise it uses the locale's
cycle), a `minuteStep` and `labels` (`hour`, `minute`, `dayPeriod`); values
remain 24-hour strings. Each segment is a native spinbutton for keyboard and
touch accessibility, with the APG spinbutton keys: ArrowUp and ArrowDown step
the hour by one (crossing AM and PM in the 12-hour cycle) and the minute by
`minuteStep` (snapping to the step), both wrapping; Home and End go to the
first and last value. An empty segment starts at its first value (ArrowUp)
or its last (ArrowDown).

Validation: `pnpm vitest run packages/primitives/tests/models.test.ts packages/primitives/tests/forms.test.ts`,
`TEXULI_E2E_PORT=4790 pnpm exec playwright test tests/behavior/scenarios/date-field.spec.ts`,
and `pnpm --filter @texuli/primitives typecheck`.
