# Calendar

`@texuli/primitives/calendar` exports an owned, headless APG grid calendar. Its date arithmetic comes from `@texuli/date`; localized month, weekday, and date labels come from `Intl.DateTimeFormat`. Dates use the Gregorian calendar.

```svelte
<script lang="ts">
  import { Calendar, CalendarDate } from '@texuli/primitives/calendar';

  let value = $state<CalendarDate | null>(null);
</script>

<Calendar.Root bind:value locale="en-GB" minValue={new CalendarDate(2026, 1, 1)}>
  <Calendar.PrevButton>Previous month</Calendar.PrevButton>
  <Calendar.Heading />
  <Calendar.NextButton>Next month</Calendar.NextButton>
  <Calendar.Grid />
</Calendar.Root>
```

`Root` supports controlled `value` and `focusedValue` bindings, `defaultValue`, `defaultFocusedValue`, `locale`, `calendar="gregory"`, `minValue`, `maxValue`, `isDateUnavailable`, `isDateDisabled`, `disabled`, and `readOnly`. `onValueChange` receives a `CalendarDate`. Prev/Next buttons honor the available date range. Other calendar systems are outside the current `@texuli/date` contract.

The grid follows the APG keyboard model: arrow keys move by day or week, Home/End move within the locale's week, PageUp/PageDown move by month, and Shift+PageUp/PageDown move by year. Horizontal movement reverses in RTL. Only the focused available day participates in the Tab order. Pointer clicks and touch taps use the same selection path.

This is headless: it supplies semantic table/grid roles and state attributes, but no visual treatment. Consumers own focus indicators, selected/disabled states, contrast, forced-colors styling, and touch target dimensions.

**Starting day.** The calendar starts on `defaultFocusedValue`, else the value, else today. When that day is disabled, it starts on the first enabled day of its month, else the next enabled day, so the grid always has a tab stop (unless every day is disabled).

