# DatePicker and DateRangePicker

**Package:** `@texuli/primitives` · **Import:** `import { DatePicker, DateRangePicker } from '@texuli/primitives/date-picker'`

These are owned, headless pickers following the WAI-ARIA [date picker dialog](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/examples/datepicker-dialog/) pattern. They compose existing primitives: a **DateField** for typing, a **button**, and a **Popover** dialog holding the **Calendar**. The range picker adds two fields and a range grid. Values are canonical `YYYY-MM-DD` strings, like the DateField's.

```svelte
<script lang="ts">
  import { DatePicker, DateRangePicker, type DateRange } from '@texuli/primitives/date-picker';
  let due = $state<string | null>('2026-03-15');
  let stay = $state<DateRange>({ start: null, end: null });
</script>

<DatePicker.Root bind:value={due} locale="en-US">
  <DatePicker.Field label="Due date" name="due" />
  <DatePicker.Trigger>📅</DatePicker.Trigger>
  <DatePicker.Content>
    <DatePicker.Calendar />
  </DatePicker.Content>
</DatePicker.Root>

<DateRangePicker.Root bind:value={stay}>
  <DateRangePicker.Field label="Stay" startName="from" endName="to" />
  <DateRangePicker.Trigger>📅</DateRangePicker.Trigger>
  <DateRangePicker.Content>
    <DateRangePicker.Calendar />
  </DateRangePicker.Content>
</DateRangePicker.Root>
```

## Parts

| Part | What it is | Props |
| --- | --- | --- |
| `DatePicker.Root` | State and the popover | `bind:value` (`YYYY-MM-DD` or `null`), `onValueChange`, `bind:open`, `onOpenChange`, `locale`, `minValue` and `maxValue` (`YYYY-MM-DD`), `isDateUnavailable(CalendarDate)`, `today` (`YYYY-MM-DD`; when set, the clock is never read), `weekStartsOn` (`0`–`6`), `onInvalid(text, reason)`, `disabled`, `closeOnSelect` (`true`), `labels` |
| `DateRangePicker.Root` | The same, for a range | `bind:value` (`{ start, end }`, always ordered), `maxDays`, and the rest as above; `closeOnSelect` closes when the range is complete |
| `*.Field` | The DateField (single), or a named `role="group"` with start and end DateFields (range) | `label`; `name`, `required` (single); `startName`, `endName` (range). The start field is capped at the end, the end field floored at the start |
| `*.Trigger` | The button: `aria-haspopup="dialog"`, `aria-expanded`, and a name that says the selected date (`Choose date, selected date is Sunday, March 15, 2026`) | button attributes; `child` snippet |
| `*.Content` | `role="dialog"`, named by `labels.dialog` | attributes |
| `DatePicker.Calendar` | The Calendar: previous, heading, next, grid; a `children` snippet replaces them | attributes |
| `DateRangePicker.Calendar` / `.Grid` | The Calendar's navigation with a range grid: `aria-multiselectable`, and `aria-selected` on every day of the range | attributes; a `.Grid` `onkeydown` runs first and `preventDefault()` in it skips the grid's keys |

The range grid marks days with `data-range-start`, `data-range-end`, `data-in-range` and `data-preview` (while the end is pending, the range previews to the hovered or focused day). Every string is translatable (`labels`: `trigger`, `triggerWithValue` with `{date}`, `dialog`, `previousMonth`, `nextMonth`, `start`, `end`, `tooLong` with `{max}`).

- **`today`:** passed to the Calendar as its today (`aria-current="date"` and the starting day). With it, neither picker reads `Date.now()` or `new Date()`.
- **`maxDays`:** the longest range, both ends included. A longer second pick or typed end is refused: the value stays, the end stays pending, `onInvalid('start/end', 'too-long')` runs and the grid's polite `role="status"` announces `labels.tooLong`.
- **`onInvalid(text, reason)`:** the fields report complete typed text that is not a date (`invalid`) or is out of bounds (`out-of-range`), once per text (see the DateField).
- **A range grid outside a picker:** `provideDateRange(state)` supplies the `DateRangeState` (`start`, `end`, `pending`, `message`, `setStart`, `setEnd`, `pick`) to a `DateRangePicker.Grid` inside a plain `Calendar.Root`; the styled `Calendar`'s range mode uses it. `rangeDays(start, end)` counts a range's days, both ends included.

## Keyboard, pointer and touch

- **Trigger:** Enter, Space, click or tap opens the dialog with focus on the selected date (the range start for ranges), else today; when that day is disabled (outside `minValue`/`maxValue` or unavailable), on the first enabled day of its month, else the next enabled day. `Content` passes this day to `Popover.Content`'s `initialFocus`, so it wins over the popover's first control (the month buttons, or the styled range picker's presets).
- **In the grid (the Calendar's APG model):**
  - arrows move by day and week (mirrored in RTL);
  - Home and End move within the week;
  - PageUp and PageDown move by month, and Shift+PageUp/PageDown by year;
  - disabled and unavailable days are skipped.
- **Choosing:** Enter, Space, a click or a tap chooses. The dialog closes, the field updates, and focus returns to the button.
- **Range:** the first choice sets the start and the second the end; an end before the start is swapped.
- **Leaving without choosing:** Escape, or a pointer press outside, closes without choosing; Escape returns focus to the button.
- **Typing:** typing in the field moves the calendar's selection.

**Not modal.** The dialog is a named `role="dialog"` like the APG example, but it is not modal: Tab can leave it, and an outside press closes it. It also guarantees focus returns to the button in WebKit, which does not focus a clicked button, so a modal focus scope would have no opener to return to.

## Behavior and tests

- **Unit:** `pnpm vitest run packages/primitives/tests/models.test.ts packages/primitives/tests/forms.test.ts`, **11 tests** (`-t date-picker`):
  - helpers (canonical parsing, range order and membership);
  - `closeOnSelect`;
  - opening focus when today is unavailable, after a minimum, and on a range start;
  - range: ordering an end picked first, and the range fields;
  - `today` and `weekStartsOn` with the clock stubbed to throw; `maxDays` refusing a picked and a typed range, with the announcement.
- **Unit (`-t calendar`):** the range grid composes a caller `onkeydown` (and `preventDefault()` skips the grid's keys).
- **Browser:** `tests/behavior/scenarios/date-picker.spec.ts`, **11 rows** on Chromium, WebKit and the Pixel 7:
  - the trigger's state, focus on the selected date, and the named dialog;
  - arrows plus Enter choose, then focus returns; PageDown;
  - Escape keeps the value; a click (tap on the Pixel 7) chooses;
  - the field drives the calendar; an outside press closes;
  - a range by keyboard selects three days;
  - **axe has no violations** with the picker open.
- **Limits:** open-to-focus p75 within 50 ms (`tests/behavior/harness/limits.ts`).

## Size

With `@texuli/date`, `@texuli/primitives/date-picker` measures **21.12 KiB** gzip (`pnpm size --filter primitives`, 2026-10-28), within its 29 KiB budget. Its composed primitives include:
- the Calendar (5.29 KiB);
- the Popover (11.88 KiB);
- the DateField (3.96 KiB).

The pickers' own code is a few KiB. When this page was first written (31.19 KiB) the Popover bundled its modal features statically; it now loads them lazily (a 4.37 KiB chunk) only for `modal`, which this non-modal picker never sets.

## Limits

- **Months shown:** one month per dialog.
- **Time:** there is no time picker; compose a TimeField.
- **Calendars:** values and display use the Gregorian calendar. Labels follow `locale`.
