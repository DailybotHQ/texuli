# Calendar rescheduling, creating and the clock

**Package:** `@texuli/data`  
**Lazy subpath:** `@texuli/data/calendar/view` (`CalendarView`)  
**Engine:** `packages/data/src/engines/calendar/move.ts` (exported from `@texuli/data/calendar`)  
**Tests:** `packages/data/tests/engines.test.ts` (engine: moves, slots and clock), `calendar-reschedule.test.ts`, `calendar-host-parity.test.ts` and `calendar-initial-scroll.test.ts` (component), `tests/e2e/data.spec.ts` (browser, the data calendar test)  
**Example:** `data-calendar`

## Goal

Move an event to another day or time slot in the month, week and day views:

- **Pointer:** drag the event chip. It snaps to whole day columns across, and
  to whole weeks (month) or slots (time grid) down. The direction is mirrored
  in RTL. A press without movement (under 4 px) is still a click that opens
  the event, and Escape cancels a drag.
- **Keyboard:** focus an event, then press Alt or Control with an arrow key.
  Alt+Arrow is the one to use on macOS, where Mission Control keeps
  Control+Arrow; Alt and Control together don't move anything.
  - **Left and right:** a day (mirrored in RTL).
  - **Up and down:** a week in the month view, or a slot in the week and day
    views. All-day events move by days only.

  A live region announces the result ("Design review moved to Thursday,
  April 16, 2026, 1:00 PM – 2:00 PM."), and focus stays on the event. Enter
  still opens it.

- **Move menu:** right-click an event, or focus it and press Shift+F10 or
  the Menu key. A long press on touch, or VoiceOver's VO+Shift+M, opens it
  too.
  - **Destinations:** 15 minutes earlier or later, 1 hour earlier or later,
    previous or next day, previous or next week. The slot and hour steps
    appear only for timed events in the week and day views.
  - **Allowed dates:** a destination outside `min` / `max` is disabled and
    says so.
  - **Choosing one:** emits the same `onChange` and announcement, and focus
    returns to the event.
  - **Loading:** the menu is a lazy chunk (`data:calendar:move-menu`,
    styled `ContextMenu` from `texuli/menus`), loaded the first time a menu
    opens.

- **Space to grab:** focus an event and press Space to pick it up
  (`aria-pressed="true"`, a dashed outline).
  - **Arrow keys:** move it with the same steps as above (left/right a day;
    up/down a week in the month view, a slot in the time grid). Each step
    is announced and shown in place.
  - **Dropping:** Space or Enter drops it and emits `onChange`. A drop in
    place cancels.
  - **Cancelling:** Escape, Tab or a pointer press cancels.
  - **Locked events and display-only calendars:** Space keeps its normal
    button behavior.

The agenda view doesn't reschedule.

## Creating events

With `onCreate`, activating an empty place creates an event:
- **Timed slot (week and day views):**
  - **Keyboard:** the focused empty slot (`[data-slot][data-focused]`, a
    button named "Empty slot, Wednesday, April 15, 2026, 9:00 AM. Enter
    adds an event"). It sits on the focused date; arrow keys move it by a
    day or a slot, wrapping past midnight.
  - **Pointer:** a click on an empty part of a day column, snapped to the
    slot under the pointer.
- **All-day:** activating a date button (month cells, week and day
  headings, agenda days) or clicking an empty all-day cell or month cell.
  Those dates carry `data-slot` and "Enter adds an all-day event".
- **Payload:** `onCreate` receives `CalendarSlot`:
  - **Timed:** `{ date, start, end, allDay: false }`, one hour, instants in
    `timeZone`.
  - **All-day:** `{ date, start: date, end: next day, allDay: true }`.
- **Read-only:** no slot is rendered and dates don't create when
  `readOnly` is set or `onCreate` is missing.

## The clock

Pass `now` (an ISO instant or epoch ms) from the app's clock:
- **Now line:** the week and day views draw it (`[data-now-line]`,
  `aria-hidden`) on the clock's date, at its wall-clock minute in
  `timeZone`. It appears only when that date is visible.
- **Today:** without `today`, `now` also sets today, so the Today button
  and the year rule below follow the clock.
- **No system clock:** the calendar never reads it. The line is part of
  the lazily rendered time grid, so it appears with the events. Render the
  calendar once your data is ready.

## Opening scroll position

The week and day views open scrolled to a useful hour instead of midnight:
- **Today in range (with `now`):** an hour above the now line, so the line
  and the hour before it are in view. Near midnight it stops at the top.
- **Otherwise:** at `scrollToHour` (default 8, working hours; clamped to
  0–23).
- **When:** only when the time grid opens (first render, or coming back
  from the month or agenda view). Moving through weeks or switching between
  week and day keeps the user's scroll position.
- **No layout shift:** the position is set as the grid mounts, before the
  first paint.
- **Motion:** never a smooth scroll (`behavior: 'instant'`), so reduced
  motion needs no special case.
- **Focus:** the calendar never moves it.
- **Hook:** `[data-time-scroller]` carries `data-open-minute`, the minute
  it opened at.

## Titles and names

- **Week and agenda titles,** with `showYear="auto"` (default):
  - **Same year as today:** "Apr 12 – Apr 18".
  - **Another year:** "Apr 12 – Apr 18, 2027".
  - **Range spans two years:** "Dec 27, 2026 – Jan 2, 2027".
- **`showYear="always"`:** every title carries the year ("May 31 – Jun 6,
  2026").
- **Month and day titles:** always carry it in both modes ("April 2026",
  "Wednesday, April 15, 2026").
- **All-day events:** named "Title, All day, <date>, press Enter to open"
  (repeating: "Title, recurring, All day, …"), so the visible title comes
  first.

## Usage

```svelte
<script lang="ts">
  import { type CalendarChange, type CalendarSeries, CalendarView } from '@texuli/data/calendar/view';

  let events = $state<CalendarSeries<{ title: string }>[]>([
    { id: 'review', start: '2026-04-15T13:00:00Z', end: '2026-04-15T14:00:00Z', data: { title: 'Design review' } },
  ]);

  function reschedule(change: CalendarChange<{ title: string }>) {
    events = events.map((series) => {
      if (series.id !== change.id) return series;
      if (!change.recurring) return { ...series, start: change.start, end: change.end };
      // One occurrence of a repeating event: store an override for it.
      const overrides = { ...series.overrides, [change.occurrenceId]: { start: change.start, end: change.end } };
      return { ...series, overrides };
    });
  }
</script>

<CalendarView {events} anchor="2026-04-15" timeZone="UTC" min="2026-04-01" max="2026-04-30" onChange={reschedule} />
```

The calendar is controlled: it emits the change, and the move shows once
`events` is updated. A rejected promise from `onChange` announces "… was
not moved." To write "this, following or all" edits of a repeating series,
use `splitSeries` from `@texuli/data/calendar`.

## Props

| Prop | Default | Meaning |
| --- | --- | --- |
| `onChange(change)` | — | Enables rescheduling. Without it, nothing can be moved. |
| `readOnly` | `false` | Disables rescheduling even when `onChange` is set. |
| `canMove(occurrence)` | — | Per-event lock: return `false` and the event can't be dragged; Control+Arrow announces "… can't be moved." |
| `min`, `max` | — | Dates (inclusive, in `timeZone`) that a moved event must stay within. A move that would leave them is refused and announced. |
| `slotMinutes` | `15` | Keyboard step and pointer snap in the time grid. |
| `onCreate(slot)` | — | Enables creating from empty slots and dates. |
| `now` | — | The app clock's instant: now line and default today. |
| `scrollToHour` | `8` | The hour the week and day views open at when the now line is not in range. |
| `showYear` | `'auto'` | `'always'` puts the year in every title; `'auto'` only when the range spans years or isn't the current year. |

**`CalendarChange`:**
- **`id`:** the series id.
- **`occurrenceId`:** the original start.
- **`start`, `end`:** in the series' format (instants, or dates when
  all-day).
- **`allDay`, `recurring`.**
- **`occurrence`:** as it was before the move.

**Duration:** always kept. A timed event moved by days keeps its wall-clock
time across DST changes.

## Accessibility

- **Name:** every event chip is named `title[, recurring], time, date,
  press Enter to open` ("Standup, 9:00 AM – 10:00 AM, Tuesday, October 20,
  2026, press Enter to open"; all-day events read "All day" for the time).
  The visible text (title, "recurring", then the time where the chip shows
  it) is always a prefix of the name, in order, in every view and for every
  event kind, so axe's label-in-name rule (WCAG 2.5.3) passes. Every piece
  comes from `labels` and the locale formats. Before 0.10.0 the date came
  before the time, which broke the rule in the agenda view.
- **Month cells:** a month gridcell has no `aria-label`; it is named by its
  content, which leads with the date button ("<date>, <n> events") and then
  the event chips. `tests/e2e/data.spec.ts` runs axe's
  `label-content-name-mismatch` rule over the month, week, day and agenda
  views.
- **Movable chips:**
  - `aria-describedby` points at a visually hidden hint ("Alt or Control
    plus arrow keys move this event. Shift+F10 opens its move options. You
    can also drag it to another day or time.");
  - `aria-keyshortcuts` lists the Alt+Arrow and Control+Arrow keys and
    Shift+F10.
- **Move menu name:** "Move <title> to…". The menu is anchored by an
  invisible region over the chip, and focus returns to the chip.
- **Announcements:** in a polite `role="status"` region inside the
  calendar.
- **Stable key:** `data-calendar-event` is the series id for a one-off
  event, and `seriesId|occurrenceId` for a repeating occurrence. It doesn't
  change when the event moves, so focus can follow it.

## Engine

`@texuli/data/calendar` exports the pure functions the view uses:
- `eventKey`;
- `applyMove`;
- `spanDates`;
- `withinBounds`;
- `moveOccurrence`, which returns `{ ok, target }` or a reason:
  `no-move` / `out-of-range`;
- `keyMove`, which maps an arrow key per view;
- `pointerMove`, which maps a pixel drag given the column width and row
  height;
- `moveChoices`, which lists the Move menu's destinations, each with its
  target, or `null` when outside the dates.

Slots and clock (`slots.ts`): `timedSlot`, `daySlot`, `slotMinuteAt`,
`stepSlot`, `nowMinute`, `MINUTES_PER_DAY`, and the `CalendarSlot` type.

Plus `SLOT_MINUTES` and `NO_MOVE`.

## Measured size

`pnpm size`, gzip (both caps 12 KiB). "Before" and "After" are from when
rescheduling landed; the last column is 2026-10-24.

| Subpath | Before | After | 2026-10-24 |
| --- | --- | --- | --- |
| `@texuli/data/calendar` | 5.84 KiB | 7.00 KiB | 7.00 KiB |
| `@texuli/data/calendar/view` | 6.61 KiB | 10.58 KiB (the Move menu, 24.44 KiB, is a lazy chunk) | 10.63 KiB + 3.23 KiB CSS (24.65 KiB lazy) |

## Limits

- **macOS:** Mission Control takes Control+Arrow, so Mac users use
  Alt+Arrow or the Move menu.
  - **Shift+F10 on a Mac:** it's no system shortcut there, so the calendar
    handles it itself.
  - **Windows and Linux:** Alt+Left is the browser's Back shortcut; the
    calendar prevents it only while an event chip has focus (covered by
    E2E).
- **Move menu:** it offers relative steps; a date or slot picker ("Move
  to…") is not built.
- **Touch:** movable chips set `touch-action: none` so a drag doesn't
  scroll the page. Swiping that starts on an event chip doesn't scroll the
  time grid; swiping elsewhere does.
- **No resizing:** changing an event's length (end-edge drag) is not
  supported.
- **Month view:** only the first three events of a day are shown; the
  "N more events" can't be dragged.
