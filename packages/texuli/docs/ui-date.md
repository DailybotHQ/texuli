# Date: Calendar, DatePicker and DateRangePicker

**Package:** `texuli` · **Import:** `import { Calendar, DatePicker, DateRangePicker } from 'texuli/date'`

These are styled date components on the owned WAI-ARIA primitives (`@texuli/primitives/calendar` and `@texuli/primitives/date-picker`). Values are `YYYY-MM-DD` strings. Every string is translatable. Range presets are built in.

```svelte
<script lang="ts">
  import { Calendar, DatePicker, DateRangePicker } from 'texuli/date';
  let due = $state<string | null>('2026-03-20');
  let period = $state({ start: '2026-03-09', end: '2026-03-15' } as { start: string | null; end: string | null });
</script>

<DatePicker label="Due date" bind:value={due} description="Shown on the invoice." />
<DateRangePicker label="Report period" bind:value={period} presets />
<Calendar bind:value={due} label="Delivery day" minValue="2026-03-02" />
```

## Components

| Component | Props |
| --- | --- |
| `Calendar` | `bind:value`, `onValueChange`, `locale`, `minValue`, `maxValue`, `isDateUnavailable`, `disabled`, `readOnly`, `size` (`sm` or `md`), `previousLabel`, `nextLabel`, `label` (the group's name) |
| `DatePicker` | `label` (visible), `description`, `error` (sets `aria-invalid` and describes the field), `bind:value`, `bind:open`, `locale`, bounds, `isDateUnavailable`, `disabled`, `required` (shows `*`), `name`, `size`, `labels` |
| `DateRangePicker` | the same, plus `bind:value` as `{ start, end }`, `startName`, `endName`; `presets`: `true` for the built-in ones, your own `DateRangePreset[]`, or `false` (default); `today` (`YYYY-MM-DD`, the day presets count from) |

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

- `pnpm vitest run packages/texuli/tests/date.test.ts`: **14 tests**.
  - Presets: values, year and leap boundaries, labels, an invalid `today`, matching.
  - Size classes.
  - Calendar: name, size, selection, bounds and unavailable days, locale digits.
  - DatePicker: label, description, the dialog and choosing, invalid, disabled, required.
  - DateRangePicker: presets with `aria-pressed`, applying a preset, custom presets and labels, no presets by default.
- In the browser (Chromium, WebKit, Pixel 7; a scratch spec on port 4810), the `texuli-date` example:
  - passes **axe** in light, dark and forced colors, closed and with the range picker open;
  - shows the "Last 7 days" preset pressed and 7 days selected, and choosing "This month" updates the range;
  - opens the date picker from the keyboard, where ArrowRight then Enter choose the next day and focus returns to the button.
- Visual baselines: `texuli-date`, light and dark, on Chromium and the Pixel 7.

## Limits

- **One month per dialog.**
- **No time selection.**
- **Popover position:** a picker that starts open (`open` initially `true`) keeps the position it computed at mount. If content above it shifts afterwards, the panel does not follow, so open pickers from a user action.
