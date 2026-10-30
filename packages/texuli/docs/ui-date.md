# Date: Calendar, DatePicker, DateRangePicker and TimeField

**Package:** `texuli` · **Import:** `import { Calendar, DatePicker, DateRangePicker, TimeField } from 'texuli/date'`

These are styled date and time components on the owned WAI-ARIA primitives (`@texuli/primitives/calendar`, `@texuli/primitives/date-picker` and `@texuli/primitives/date-field`). Date values are `YYYY-MM-DD` strings; time values are 24-hour `HH:mm` strings. Every string is translatable. Range presets are built in.

```svelte
<script lang="ts">
  import { Calendar, DatePicker, DateRangePicker } from 'texuli/date';
  let due = $state<string | null>('2026-03-20');
  let period = $state({ start: '2026-03-09', end: '2026-03-15' } as { start: string | null; end: string | null });
  let starts = $state<string | null>('09:30');
</script>

<DatePicker label="Due date" bind:value={due} description="Shown on the invoice." />
<DateRangePicker label="Report period" bind:value={period} presets />
<Calendar bind:value={due} label="Delivery day" minValue="2026-03-02" />
<TimeField label="Starts" bind:value={starts} hourCycle={12} minuteStep={15} />
```

**Deterministic dates.** Pass `today` (`YYYY-MM-DD`) to `Calendar`, `DatePicker` or `DateRangePicker` and the component never reads the clock (`Date.now()` or `new Date()`): today's mark, the starting day and the presets all come from it. Use it for simulated clocks, server-rendered pages and tests.

```svelte
<DateRangePicker
  label="Report period"
  bind:value={period}
  today={scenario.today}
  weekStartsOn={1}
  maxDays={31}
  onInvalid={(text, reason) => (problem = `${text}: ${reason}`)}
/>
<Calendar label="Stay" bind:range={stay} today={scenario.today} maxDays={14} />
```

## Components

| Component | Props |
| --- | --- |
| `Calendar` | `bind:value`, `onValueChange`, `defaultFocusedValue` (the day it opens on, so it can show a month with nothing selected), `bind:focusedValue` and `onFocusedValueChange` (the focused day, `YYYY-MM-DD`: setting it moves the month shown), `locale`, `minValue`, `maxValue`, `isDateUnavailable`, `today`, `weekStartsOn`, `disabled`, `readOnly`, `size` (`sm` or `md`), `previousLabel`, `nextLabel`, `label` (the group's name); range mode: `bind:range` (`{ start, end }`), `onRangeChange`, `maxDays`, `onInvalid`, `tooLongLabel` |
| `DatePicker` | `label` (visible), `description`, `error` (sets `aria-invalid` and describes the field), `bind:value`, `bind:open`, `locale`, bounds, `isDateUnavailable`, `today`, `weekStartsOn`, `onInvalid`, `disabled`, `required` (shows `*`), `name`, `size`, `labels`, `class` (the wrapper), `controlClass` (the bordered `.tx-date__control` that holds the segments and the calendar button) |
| `DateRangePicker` | the same, plus `bind:value` as `{ start, end }`, `startName`, `endName`, `required` (every segment of both dates, `*` after the label), `maxDays`, `onInvalid(text, reason, { side })` (`side`: the start or the end caused the refusal); `presets`: `true` for the built-in ones, your own `DateRangePreset[]`, or `false` (default); `today` (`YYYY-MM-DD`: the day presets count from and the calendar marks) |
| `TimeField` | `label` (visible), `description`, `error`, `bind:value` (`HH:mm`, 24-hour, or `null`), `onValueChange`, `locale`, `hourCycle` (`12` or `24`; default the locale's), `minuteStep` (default `1`), `disabled`, `required`, `name`, `size`, `labels` (`hour`, `minute`, `dayPeriod`) |

- **Inside a `Field`, and `id`.** `DatePicker`, `DateRangePicker` and `TimeField` take `hideLabel` (the visible label hides; it still names the field group). Inside a `Field` the label always hides and the group is named by the Field label, so it is never shown twice. `id` lands on the first segment (so `<label for>` focuses it), and `aria-describedby` and `aria-invalid` (from `{...control.props}`) reach every segment. A Field `error` (its `aria-invalid`) shows the same invalid state as the control's own `error`: `data-invalid="true"` on the wrapper and the danger border on the control. Other `aria-*`, `data-*` and handlers go to the field group, layout hooks to the wrapper; `bind:ref` is the wrapper (`Calendar`: its root).
- **`today`** (`YYYY-MM-DD`): the day marked with `aria-current="date"` and the starting day when nothing is chosen. When it is set, no component reads the clock.
- **`weekStartsOn`**: `0` (Sunday) to `6` (Saturday). Without it, weeks start on the locale's first day (`localeWeekStart(locale)` from `@texuli/date`: `en-US` Sunday, `en-GB` Monday).
- **Calendar range mode:** pass `range` (`bind:range`, `{ start, end }`). The grid is `aria-multiselectable`; every day of the span has `aria-selected="true"`, and the days carry `data-range-start`, `data-range-end` and `data-in-range` for styling. The first pick sets the start, the second the end (an end before the start is swapped).
- **`maxDays`** (ranges): the longest range in days, both ends included. A longer pick or typed end is refused: the value stays, the end stays pending, `onInvalid('start/end', 'too-long')` runs, and the grid's polite `role="status"` says `Choose a range of {max} days or fewer.` (`labels.tooLong`, or `tooLongLabel` on the Calendar). Presets longer than `maxDays` are not offered.
- **`onInvalid(text, reason)`**: typed text that is complete (month, day and a four-digit year) but not a real date (`invalid`, like `2/30/2026`) or outside `minValue`/`maxValue` (`out-of-range`) is reported once, with the segments in locale order; the segments get `aria-invalid="true"` until the entry is fixed. Show your message through `error`.
- **TimeField keyboard:** each segment is a spinbutton. ArrowUp and ArrowDown step the hour by one (crossing AM and PM in the 12-hour cycle) and the minute by `minuteStep` (snapping to the step and wrapping); Home and End go to the first and last value; digits type a value.

- **Built-in presets** (`dateRangePresets(today, labels)`, pure): Today, Yesterday, Last 7 days, Last 30 days, This month (so far) and Last month.
- **Choosing a preset** sets the range and closes the dialog. The preset that matches the current range has `aria-pressed="true"`.
- **Labels** (`labels`): the primitives' `trigger`, `triggerWithValue`, `dialog`, `previousMonth`, `nextMonth`, `start` and `end`, plus `presets` (the list's heading) and `presetLabels`.

## Behavior and accessibility

All behavior comes from the primitives (see `packages/primitives/docs/prim-date-picker.md`):
- **Field:** a segmented DateField.
- **Button:** named with the selected date.
- **Dialog:** `role="dialog"`. Opening focuses the selected day.
- **Calendar keyboard:** the APG grid model (arrows mirrored in RTL, Home/End, PageUp/PageDown, Shift for years).
- **Choosing** closes the dialog and returns focus to the button.
- **Escape** or an outside press closes without choosing.

The styling adds:
- **Colors:** each is a contract pair held to AA.
  - The chosen day and a range's ends: `primary` on `primary-foreground`, bold.
  - The days between the ends and the active preset: `selection` on `selection-foreground`.
  - Today: a `border-strong` ring, bold.
  - Days outside the month: `muted-foreground`.
  - Unavailable days: struck through, and disabled.
- **Forced colors:** `Highlight` / `HighlightText` for chosen and in-range days.
- **Layout:** logical properties; RTL mirrors the header and grid. Targets meet `--tx-target-size`.
- **Digits:** day numbers use the locale's digits, matching the day names (`ar-EG` shows ١٢).

## Verified

- `pnpm vitest run packages/texuli/tests/forms.test.ts -t '^date '`: **6 tests**.
  - Presets: year and leap boundaries, labels, an invalid `today`, matching.
  - Calendar: bounds and unavailable days, locale digits.
  - DateRangePicker: applying a preset, and opening focus on the range start.
- `pnpm vitest run packages/texuli/tests/date-time.test.ts`: **9 tests**.
  - `today` on all three components with `Date.now()` and `new Date()` stubbed to throw; `weekStartsOn` and the locale week start.
  - Calendar range mode: the highlighted span and its `aria-selected` days; two-step picks, and a range over `maxDays` refused and announced.
  - `onInvalid` for typed text (`invalid`, `out-of-range`) and a typed range over `maxDays`; longer presets hidden.
  - TimeField: the 12- and 24-hour cycles, minute steps on the arrow keys, and the description, error and translated segment names.
- In the browser (Chromium, WebKit, Pixel 7; a scratch spec on port 4810), the `texuli-date` example:
  - passes **axe** in light, dark and forced colors, closed and with the range picker open;
  - shows the "Last 7 days" preset pressed and 7 days selected, and choosing "This month" updates the range;
  - opens the date picker from the keyboard, where ArrowRight then Enter choose the next day and focus returns to the button.
- Visual baselines: `texuli-date`, light and dark, on Chromium and the Pixel 7.

## Limits

- **One month per dialog.**
- **Time is a separate field:** compose a `TimeField` beside a `DatePicker`; there is no combined date-time picker.
- **Popover position:** a picker that starts open (`open` initially `true`) keeps the position it computed at mount. If content above it shifts afterwards, the panel does not follow, so open pickers from a user action.
