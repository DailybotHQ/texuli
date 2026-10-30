<script lang="ts" generics="TData = unknown">
import { lazyChunk } from '@texuli/core/lazy';
import { createPointerTracker } from '@texuli/drag/gesture';
import { applyModifiers, snapToGrid } from '@texuli/drag/modifiers';
import { type Component, tick } from 'svelte';
import { type ClassValue } from 'texuli/cx';
import {
  addDays,
  applyMove,
  type CalendarView as CalendarMode,
  type CalendarMove,
  type CalendarSeries,
  type CalendarSlot,
  dateIn,
  daySlot,
  eventKey,
  expandAll,
  formatIsoDate,
  type IsoDate,
  isNoMove,
  keyMove,
  MAX_OCCURRENCES,
  type MoveChoice,
  moveChoices,
  moveOccurrence,
  NO_MOVE,
  type Occurrence,
  parseInstant,
  parseIsoDate,
  pointerMove,
  SLOT_MINUTES,
  spanDates,
  stepAnchor,
  stepSlot,
  timedSlot,
  visibleRange,
  weekDates,
  weekStartFor,
} from '../engines/calendar/index.ts';
import type { MoveMenuRequest } from './CalendarMoveMenu.svelte';
import { describeWhen, formatCalendar } from './model.ts';
import type { CalendarChange, CalendarItem, CalendarLabels, CalendarTone } from './types.ts';
import { DEFAULT_CALENDAR_LABELS } from './types.ts';

type CalendarProps<T> = {
  events: readonly CalendarSeries<T>[];
  anchor: IsoDate;
  today?: IsoDate;
  label?: string;
  locale?: string;
  timeZone?: string;
  view?: CalendarMode;
  agendaDays?: number;
  weekStartsOn?: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  labels?: Partial<CalendarLabels>;
  getTitle?: (occurrence: Occurrence<T>) => string;
  getTone?: (occurrence: Occurrence<T>) => CalendarTone;
  onOpen?: (occurrence: Occurrence<T>) => void;
  /**
   * Called when an event is dragged, or moved with Ctrl+Arrow keys, to another
   * day or slot (month, week and day views). Without it nothing can be moved.
   * Update `events` with the new start and end to show the move.
   */
  onChange?: (change: CalendarChange<T>) => unknown;
  /** Nothing can be moved, even with `onChange`. */
  readOnly?: boolean;
  /** Per-event lock: return false for events that cannot be moved. */
  canMove?: (occurrence: Occurrence<T>) => boolean;
  /** First date an event may be moved to (inclusive, in `timeZone`). */
  min?: IsoDate;
  /** Last date an event may be moved to (inclusive, in `timeZone`). */
  max?: IsoDate;
  /** Minutes per keyboard step and pointer snap in the time grid (default 15). */
  slotMinutes?: number;
  /**
   * Called when an empty slot (week and day views) or a date (all-day) is
   * activated, by click or keyboard. Without it nothing is created.
   */
  onCreate?: (slot: CalendarSlot) => unknown;
  /**
   * The current instant from the app's clock (ISO string or epoch ms). It
   * draws the "now" line in the week and day views and, without `today`,
   * sets today. The calendar never reads the system clock.
   */
  now?: string | number;
  /**
   * The year in the title. `auto` (default): week and agenda ranges show it
   * when they span two years or are not the current year. `always`: every
   * title shows it ("May 31 – Jun 6, 2026"). Month and day titles always
   * carry it ("April 2026", "Wednesday, April 15, 2026").
   */
  showYear?: 'auto' | 'always';
  /**
   * The hour the week and day views open at (default 8) when today's "now"
   * line is not in range; with it in range they open just above the line.
   */
  scrollToHour?: number;
  dir?: 'ltr' | 'rtl' | 'auto';
  class?: ClassValue;
};

let {
  events,
  anchor,
  today,
  label = 'Calendar',
  locale = 'en-US',
  timeZone = 'UTC',
  view = $bindable('week'),
  agendaDays = 14,
  weekStartsOn,
  labels: labelOverrides,
  getTitle,
  getTone = () => 'primary',
  onOpen,
  onChange,
  readOnly = false,
  canMove,
  min,
  max,
  slotMinutes = SLOT_MINUTES,
  onCreate,
  now,
  showYear = 'auto',
  scrollToHour = 8,
  dir = 'auto',
  class: className,
}: CalendarProps<TData> = $props();

const labels = $derived({ ...DEFAULT_CALENDAR_LABELS, ...labelOverrides });
// svelte-ignore state_referenced_locally -- seed the local navigation cursor from the anchor once.
let at = $state<IsoDate>(anchor);
// svelte-ignore state_referenced_locally -- seed roving focus from the initial anchor once.
let focusDate = $state<IsoDate>(anchor);
let root = $state<HTMLElement | null>(null);
$effect(() => {
  at = anchor;
  focusDate = anchor;
});

const nowMs = $derived(
  now === undefined ? undefined : typeof now === 'number' ? now : parseInstant(now)
);
const nowDate = $derived(today ?? (nowMs === undefined ? anchor : dateIn(nowMs, timeZone)));
const canCreate = $derived(onCreate !== undefined && !readOnly);
// The focused empty slot of the time grid: on the focused date, at this minute.
let slotMinute = $state(9 * 60);
const firstWeekday = $derived(weekStartsOn ?? weekStartFor(locale));
const range = $derived(
  visibleRange(view, at, { weekStartsOn: firstWeekday, timeZone, agendaDays })
);
const fmt = $derived(formatCalendar(locale, timeZone));
const expansion = $derived(expandAll(events, { start: range.start, end: range.end }, { timeZone }));
const editable = $derived(onChange !== undefined && !readOnly && view !== 'agenda');
// Picked up with Space: the item as it was, and how far the arrow keys have moved it.
let grab = $state.raw<{ item: CalendarItem<TData>; move: CalendarMove } | null>(null);
const items = $derived.by<CalendarItem<TData>[]>(() => {
  const list: CalendarItem<TData>[] = expansion.occurrences.map((occurrence) => {
    const key = eventKey(occurrence);
    return {
      ...occurrence,
      id: key,
      key,
      title: getTitle
        ? getTitle(occurrence)
        : String(
            (occurrence.data as { title?: unknown } | undefined)?.title ?? labels.untitledEvent
          ),
      tone: getTone(occurrence),
      movable: editable && (canMove?.(occurrence) ?? true),
    };
  });
  if (!grab) return list;
  const held = { ...grab.item, ...applyMove(grab.item, grab.move, timeZone), grabbed: true };
  const index = list.findIndex((item) => item.key === held.key);
  // It stays visible even when the original occurrence is outside the range.
  if (index < 0) list.push(held);
  else list[index] = held;
  return list;
});
const byKey = $derived(new Map(items.map((item) => [item.key, item])));
const uid = $props.id();
const hintId = `${uid}-move-hint`;
let announcement = $state('');
const title = $derived(
  view === 'month'
    ? fmt.monthTitle(at)
    : view === 'day'
      ? fmt.longDate(at)
      : fmt.range(
          range.startDate,
          addDays(range.endDate, -1),
          parseIsoDate(nowDate).year,
          showYear === 'always'
        )
);

function step(direction: -1 | 1): void {
  at = stepAnchor(view, at, direction, agendaDays);
  focusDate = at;
}

function goToday(): void {
  at = nowDate;
  focusDate = nowDate;
}

function switchMode(next: CalendarMode): void {
  view = next;
  at = focusDate;
}

async function focusCurrentDate(): Promise<void> {
  await tick();
  const button = [
    ...(root?.querySelectorAll<HTMLButtonElement>('[data-calendar-date]') ?? []),
  ].find((candidate) => candidate.getAttribute('data-calendar-date') === focusDate);
  button?.focus();
}

function isRtlAt(element: HTMLElement): boolean {
  return (
    dir === 'rtl' ||
    (dir === 'auto' &&
      element.ownerDocument.defaultView?.getComputedStyle(element).direction === 'rtl')
  );
}

function announce(text: string): void {
  // Re-set so the same message is announced again.
  announcement = '';
  void tick().then(() => (announcement = text));
}

async function focusEvent(key: string): Promise<void> {
  await tick();
  root?.querySelector<HTMLElement>(`[data-calendar-event="${CSS.escape(key)}"]`)?.focus();
}

/** Checks, emits `onChange`, keeps the moved event in view and focused, and announces the result. */
async function reschedule(item: CalendarItem<TData>, move: CalendarMove): Promise<void> {
  if (!onChange) return;
  if (!item.movable) {
    announce(labels.cannotMove(item.title));
    return;
  }
  const result = moveOccurrence(item, move, { timeZone, min, max });
  if (!result.ok) {
    if (result.reason === 'out-of-range') announce(labels.outOfRange(item.title));
    return;
  }
  const { target } = result;
  const {
    id: _id,
    key: _key,
    title: _title,
    tone: _tone,
    movable: _movable,
    grabbed: _grabbed,
    ...occurrence
  } = item;
  try {
    await onChange({
      id: item.seriesId,
      occurrenceId: item.occurrenceId,
      start: target.start,
      end: target.end,
      allDay: item.allDay,
      recurring: item.recurring,
      occurrence: occurrence as Occurrence<TData>,
    });
  } catch {
    announce(labels.moveFailed(item.title));
    return;
  }
  const first = spanDates({ ...target, allDay: item.allDay }, timeZone).first;
  if (first < range.startDate || first >= range.endDate) at = first;
  focusDate = first;
  announce(
    labels.moved(
      item.title,
      describeWhen(fmt, { ...target, allDay: item.allDay }, labels.allDay, timeZone)
    )
  );
  void focusEvent(item.key);
}

async function create(slot: CalendarSlot): Promise<void> {
  if (canCreate) await onCreate?.(slot);
}

async function focusSlot(): Promise<void> {
  await tick();
  root?.querySelector<HTMLElement>('[data-slot][data-focused]')?.focus();
}

/** Space picked an event up: arrows move it, Space or Enter drops it, Escape or Tab cancels. */
function onGrabKey(
  event: KeyboardEvent,
  held: { item: CalendarItem<TData>; move: CalendarMove }
): void {
  const { item, move } = held;
  if (event.key === 'Escape' || event.key === 'Tab') {
    if (event.key === 'Escape') event.preventDefault();
    grab = null;
    announce(labels.moveCancelled);
    if (event.key === 'Escape') void focusEvent(item.key);
    return;
  }
  if (event.key === ' ' || event.key === 'Enter') {
    event.preventDefault();
    grab = null;
    if (isNoMove(move)) {
      announce(labels.moveCancelled);
      void focusEvent(item.key);
    } else void reschedule(item, move);
    return;
  }
  const chip = event.target as HTMLElement;
  const delta =
    event.altKey || event.ctrlKey || event.metaKey
      ? null
      : keyMove(event.key, { view, allDay: item.allDay, rtl: isRtlAt(chip), slotMinutes });
  if (!delta) return;
  event.preventDefault();
  const next = { days: move.days + delta.days, minutes: move.minutes + delta.minutes };
  const result = moveOccurrence(item, next, { timeZone, min, max });
  if (!result.ok) {
    if (result.reason === 'out-of-range') announce(labels.outOfRange(item.title));
    return;
  }
  grab = { item, move: next };
  const target = { ...result.target, allDay: item.allDay };
  const first = spanDates(target, timeZone).first;
  if (first < range.startDate || first >= range.endDate) at = first;
  focusDate = first;
  announce(labels.grabMoved(item.title, describeWhen(fmt, target, labels.allDay, timeZone)));
  void focusEvent(item.key);
}

/** Arrow keys on the focused empty slot: a day across, a slot up or down. */
function onSlotKey(event: KeyboardEvent, slot: HTMLElement): boolean {
  const rtl = isRtlAt(slot);
  const days =
    event.key === 'ArrowLeft' ? (rtl ? 1 : -1) : event.key === 'ArrowRight' ? (rtl ? -1 : 1) : 0;
  const minutes =
    event.key === 'ArrowUp' ? -slotMinutes : event.key === 'ArrowDown' ? slotMinutes : 0;
  if (!days && !minutes) return false;
  event.preventDefault();
  const next = stepSlot({ date: focusDate, minute: slotMinute }, days, minutes);
  slotMinute = next.minute;
  focusDate = next.date;
  if (view === 'day' || next.date < range.startDate || next.date >= range.endDate) at = next.date;
  void focusSlot();
  return true;
}

function onKeydown(event: KeyboardEvent): void {
  if (grab) {
    onGrabKey(event, grab);
    return;
  }
  const eventChip = (event.target as HTMLElement).closest<HTMLElement>('[data-calendar-event]');
  if (eventChip && event.key === ' ' && !event.altKey && !event.ctrlKey && !event.metaKey) {
    const item = byKey.get(eventChip.getAttribute('data-calendar-event') ?? '');
    if (item?.movable) {
      event.preventDefault();
      grab = { item, move: NO_MOVE };
      announce(labels.grabbed(item.title));
      return;
    }
  }
  if (eventChip && event.key === 'Escape' && drag) {
    event.preventDefault();
    cancelDrag();
    return;
  }
  if (eventChip && ((event.shiftKey && event.key === 'F10') || event.key === 'ContextMenu')) {
    event.preventDefault();
    void openMoveMenu(eventChip);
    return;
  }
  // Alt+Arrow is the alternate for Control+Arrow, which macOS keeps for Mission Control.
  if (eventChip && event.ctrlKey !== event.altKey && !event.metaKey && !event.shiftKey) {
    const item = byKey.get(eventChip.getAttribute('data-calendar-event') ?? '');
    const move =
      item && onChange && view !== 'agenda'
        ? keyMove(event.key, { view, allDay: item.allDay, rtl: isRtlAt(eventChip), slotMinutes })
        : null;
    if (item && move) {
      event.preventDefault();
      void reschedule(item, move);
      return;
    }
  }
  if (
    event.altKey ||
    event.ctrlKey ||
    event.metaKey ||
    (event.target as HTMLElement).closest('input, textarea, select, [contenteditable="true"]')
  )
    return;
  const target = event.target as HTMLElement;
  const slot = target.closest<HTMLElement>('[data-slot][data-focused]');
  if (slot && onSlotKey(event, slot)) return;
  const key = event.key.toLowerCase();
  const modeByKey: Record<string, CalendarMode> = { m: 'month', w: 'week', d: 'day', a: 'agenda' };
  const nextMode = modeByKey[key];
  if (!event.shiftKey && nextMode) {
    event.preventDefault();
    switchMode(nextMode);
    void focusCurrentDate();
    return;
  }
  const dateButton = target.closest<HTMLElement>('[data-calendar-date]');
  if (!dateButton) return;
  const date = dateButton.getAttribute('data-calendar-date');
  if (!date) return;
  let offset = 0;
  const isRtl = isRtlAt(target);
  if (event.key === 'ArrowLeft') offset = isRtl ? 1 : -1;
  if (event.key === 'ArrowRight') offset = isRtl ? -1 : 1;
  if (event.key === 'ArrowUp') offset = -7;
  if (event.key === 'ArrowDown') offset = 7;
  if (event.key === 'Home')
    offset = -((new Date(`${date}T00:00:00Z`).getUTCDay() - firstWeekday + 7) % 7);
  if (event.key === 'End')
    offset = 6 - ((new Date(`${date}T00:00:00Z`).getUTCDay() - firstWeekday + 7) % 7);
  if (!offset) return;
  event.preventDefault();
  const { year, month, day } = parseIsoDate(date);
  focusDate = formatIsoDate(year, month, day + offset);
  if (
    view === 'month' ||
    view === 'day' ||
    focusDate < range.startDate ||
    focusDate >= range.endDate
  )
    at = focusDate;
  void focusCurrentDate();
}

// Pointer: drag an event across day columns (and down by weeks or time slots),
// on @texuli/drag: the gesture tracker owns the drag lifecycle (4 px
// threshold, one pointer, pointercancel = cancel), and a snap modifier is the
// time strategy (one day column by one slot, or one week row in the month), so
// the drop is a whole number of days and slots.
// Not reactive: it holds the dragged element, and nothing renders from it.
let drag: {
  item: CalendarItem<TData>;
  chip: HTMLElement;
  pointerId: number;
  columnWidth: number;
  rowHeight: number;
  rtl: boolean;
} | null = null;
let suppressClick = false;

function dragGeometry(
  chip: HTMLElement,
  allDay: boolean
): { columnWidth: number; rowHeight: number } {
  if (view === 'month') {
    const cell = chip.closest<HTMLElement>('[role="gridcell"]');
    const row = chip.closest<HTMLElement>('[role="row"]');
    return {
      columnWidth: cell?.getBoundingClientRect().width ?? 0,
      rowHeight: row?.getBoundingClientRect().height ?? 0,
    };
  }
  const column = chip.closest<HTMLElement>(allDay ? '[data-allday]' : '[data-day-column]');
  const rect = column?.getBoundingClientRect();
  return { columnWidth: rect?.width ?? 0, rowHeight: allDay ? 0 : (rect?.height ?? 0) / 1440 };
}

/** The time strategy as a modifier: one day column across, one slot (or week row) down. */
function timeSnap(item: CalendarItem<TData>, columnWidth: number, rowHeight: number) {
  const down = view === 'month' ? rowHeight : item.allDay ? 0 : rowHeight * slotMinutes;
  return snapToGrid({ x: columnWidth, y: down });
}

function snappedMove(travel: { x: number; y: number }): CalendarMove {
  if (!drag) return { days: 0, minutes: 0 };
  const delta = applyModifiers([timeSnap(drag.item, drag.columnWidth, drag.rowHeight)], travel);
  return pointerMove(delta.x, delta.y, {
    view,
    allDay: drag.item.allDay,
    columnWidth: drag.columnWidth,
    rowHeight: drag.rowHeight,
    rtl: drag.rtl,
    slotMinutes,
  });
}

function clearDragStyle(chip: HTMLElement): void {
  chip.removeAttribute('data-dragging');
  chip.style.removeProperty('--tx-calendar-drag-x');
  chip.style.removeProperty('--tx-calendar-drag-y');
}

function endDrag(): void {
  if (!drag) return;
  if (drag.chip.hasPointerCapture?.(drag.pointerId))
    drag.chip.releasePointerCapture(drag.pointerId);
  clearDragStyle(drag.chip);
  drag = null;
}

const tracker = createPointerTracker({
  onMove: (event) => {
    if (!drag) return;
    // The chip follows the pointer; the drop snaps.
    drag.chip.setAttribute('data-dragging', '');
    drag.chip.style.setProperty('--tx-calendar-drag-x', `${event.delta.x}px`);
    drag.chip.style.setProperty('--tx-calendar-drag-y', `${event.delta.y}px`);
  },
  onEnd: (event) => {
    if (!drag) return;
    const { item } = drag;
    const move = snappedMove(event.delta);
    endDrag();
    // The click that follows a drag must not open the event.
    suppressClick = true;
    setTimeout(() => (suppressClick = false), 0);
    void reschedule(item, move);
  },
  onClick: () => endDrag(),
  onCancel: () => endDrag(),
});

/** Escape, the move menu or a context menu: drop the pointer drag without moving. */
function cancelDrag(): void {
  tracker.cancel();
  endDrag();
}

function onPointerDown(event: PointerEvent): void {
  if (grab) {
    grab = null;
    announce(labels.moveCancelled);
  }
  if (event.button !== 0 || !event.isPrimary) return;
  const chip = (event.target as HTMLElement).closest<HTMLElement>('[data-calendar-event]');
  const item = chip ? byKey.get(chip.getAttribute('data-calendar-event') ?? '') : undefined;
  if (!chip || !item?.movable || !tracker.down(event)) return;
  drag = {
    item,
    chip,
    pointerId: event.pointerId,
    ...dragGeometry(chip, item.allDay),
    rtl: isRtlAt(chip),
  };
  chip.setPointerCapture?.(event.pointerId);
}

function onClickCapture(event: MouseEvent): void {
  if (!suppressClick) return;
  if ((event.target as HTMLElement).closest('[data-calendar-event]')) {
    event.stopPropagation();
    event.preventDefault();
  }
  suppressClick = false;
}

// The "Move" menu: a lazy chunk, loaded the first time an event's menu opens.
type MoveMenuProps = { request: MoveMenuRequest | null; onSelect: (choice: MoveChoice) => void };
let MoveMenu = $state.raw<Component<MoveMenuProps> | undefined>();
let moveRequest = $state.raw<(MoveMenuRequest & { key: string }) | null>(null);
let moveNonce = 0;

async function openMoveMenu(chip: HTMLElement): Promise<void> {
  const item = byKey.get(chip.getAttribute('data-calendar-event') ?? '');
  if (!item || !onChange || view === 'agenda') return;
  if (!item.movable) {
    announce(labels.cannotMove(item.title));
    return;
  }
  if (!MoveMenu) {
    const module = await lazyChunk(
      'data:calendar:move-menu',
      () => import('./CalendarMoveMenu.svelte')
    );
    MoveMenu = module.default as unknown as Component<MoveMenuProps>;
  }
  const choices = moveChoices(item, { view, bounds: { timeZone, min, max }, slotMinutes }).map(
    (choice) => ({
      choice,
      label: `${labels.moveChoice(choice.id, slotMinutes)}${choice.target ? '' : `, ${labels.outsideDates}`}`,
    })
  );
  moveNonce += 1;
  moveRequest = {
    chip,
    key: item.key,
    label: labels.moveMenu(item.title),
    choices,
    nonce: moveNonce,
  };
}

function onMoveSelect(choice: MoveChoice): void {
  const item = moveRequest ? byKey.get(moveRequest.key) : undefined;
  if (item) void reschedule(item, choice.move);
}

function onContextMenu(event: MouseEvent): void {
  const chip = (event.target as HTMLElement).closest<HTMLElement>('[data-calendar-event]');
  if (!chip || !byKey.get(chip.getAttribute('data-calendar-event') ?? '')?.movable) return;
  // Right click, the Menu key, a long press or VoiceOver's VO+Shift+M.
  event.preventDefault();
  cancelDrag();
  void openMoveMenu(chip);
}

function createAt(date: IsoDate, minute: number): void {
  slotMinute = minute;
  focusDate = date;
  void create(timedSlot(date, minute, timeZone));
}

const modes: readonly CalendarMode[] = ['month', 'week', 'day', 'agenda'];
const modeLabels = $derived.by(
  () =>
    ({
      month: labels.month,
      week: labels.week,
      day: labels.day,
      agenda: labels.agenda,
    }) satisfies Record<CalendarMode, string>
);
</script>

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<section
  bind:this={root}
  class={`tx-calendar ${className ?? ''}`}
  aria-label={label}
  data-calendar
  data-view={view}
  dir={dir}
  onkeydown={onKeydown}
  onpointerdown={onPointerDown}
  onpointermove={(event) => tracker.move(event)}
  onpointerup={(event) => tracker.up(event)}
  onpointercancel={(event) => tracker.cancel(event)}
  onclickcapture={onClickCapture}
  oncontextmenu={onContextMenu}
>
  <header class="tx-calendar__header">
    <div class="tx-calendar__navigation" role="group" aria-label={`${label} navigation`}>
      <button type="button" aria-label={labels.previous} onclick={() => step(-1)}>‹</button>
      <button type="button" onclick={goToday}>{labels.today}</button>
      <button type="button" aria-label={labels.next} onclick={() => step(1)}>›</button>
    </div>
    <h2 aria-live="polite">{title}</h2>
    <div class="tx-calendar__modes" role="group" aria-label={labels.viewModes}>
      {#each modes as mode (mode)}
        <button type="button" aria-pressed={view === mode} aria-keyshortcuts={mode[0]?.toUpperCase()} onclick={() => switchMode(mode)}>{modeLabels[mode]}</button>
      {/each}
    </div>
  </header>
  {#if view === 'month'}
    {#await lazyChunk('data:calendar:month', () => import('./MonthView.svelte'))}
      <p role="status" class="tx-calendar__loading">{labels.loading}</p>
    {:then { default: MonthView }}
      <MonthView anchor={at} today={nowDate} {focusDate} {items} {fmt} {timeZone} weekStartsOn={firstWeekday} {labels} onOpen={(item) => onOpen?.(item as Occurrence<TData>)} {hintId} onFocusDate={(date) => (focusDate = date)} onCreateDay={canCreate ? (date) => create(daySlot(date)) : undefined} />
    {:catch}
      <p role="alert" class="tx-calendar__loading">{labels.loading}</p>
    {/await}
  {:else if view === 'agenda'}
    {#await lazyChunk('data:calendar:agenda', () => import('./AgendaView.svelte'))}
      <p role="status" class="tx-calendar__loading">{labels.loading}</p>
    {:then { default: AgendaView }}
      <AgendaView startDate={range.startDate} endDate={range.endDate} {focusDate} {items} {fmt} {timeZone} {labels} onOpen={(item) => onOpen?.(item as Occurrence<TData>)} {hintId} onFocusDate={(date) => (focusDate = date)} onCreateDay={canCreate ? (date) => create(daySlot(date)) : undefined} />
    {:catch}
      <p role="alert" class="tx-calendar__loading">{labels.loading}</p>
    {/await}
  {:else}
    {#await lazyChunk('data:calendar:time-grid', () => import('./TimeGridView.svelte'))}
      <p role="status" class="tx-calendar__loading">{labels.loading}</p>
    {:then { default: TimeGridView }}
      <TimeGridView dates={view === 'week' ? weekDates(at, firstWeekday) : [at]} {focusDate} {items} {fmt} {timeZone} {labels} onOpen={(item) => onOpen?.(item as Occurrence<TData>)} {hintId} onFocusDate={(date) => (focusDate = date)} {nowMs} {slotMinute} {slotMinutes} {scrollToHour} onCreateDay={canCreate ? (date) => create(daySlot(date)) : undefined} onCreateAt={canCreate ? createAt : undefined} />
    {:catch}
      <p role="alert" class="tx-calendar__loading">{labels.loading}</p>
    {/await}
  {/if}
  {#if MoveMenu}<MoveMenu request={moveRequest} onSelect={onMoveSelect} />{/if}
  {#if editable}<p id={hintId} class="tx-calendar__sr-only">{labels.moveHint}</p>{/if}
  <p class="tx-calendar__sr-only" role="status" aria-live="polite" data-calendar-announcer>{announcement}</p>
  {#if expansion.truncated}<p class="tx-calendar__note" role="note">{labels.truncationNote(MAX_OCCURRENCES)}</p>{/if}
</section>

<style>
  .tx-calendar { display: flex; min-inline-size: 0; flex-direction: column; overflow: hidden; border: var(--tx-border-width-thin) solid var(--tx-border, ButtonBorder); border-radius: var(--tx-shape-radius-xl); background: var(--tx-background, Canvas); color: var(--tx-foreground, CanvasText); }
  .tx-calendar__header { display: flex; flex-wrap: wrap; align-items: center; gap: var(--tx-space-2); border-block-end: var(--tx-border-width-thin) solid var(--tx-border, ButtonBorder); padding: var(--tx-space-2); }
  .tx-calendar__header h2 { min-inline-size: 8rem; flex: 1; margin: 0; font-size: var(--tx-type-body-size); font-weight: 650; }
  .tx-calendar__navigation, .tx-calendar__modes { display: flex; align-items: center; gap: calc(var(--tx-space-unit) * 0.8); }
  .tx-calendar__navigation button, .tx-calendar__modes button { min-block-size: 2rem; border: var(--tx-border-width-thin) solid transparent; border-radius: var(--tx-shape-radius-md); background: transparent; padding-inline: calc(var(--tx-space-unit) * 2.2); color: inherit; font: inherit; font-size: .8rem; }
  .tx-calendar__navigation button:hover, .tx-calendar__modes button[aria-pressed="true"] { border-color: var(--tx-border, ButtonBorder); background: var(--tx-muted, ButtonFace); }
  .tx-calendar button:focus-visible { outline: var(--tx-focus-ring-width, 2px) solid var(--tx-ring, Highlight); outline-offset: 2px; }
  .tx-calendar__loading, .tx-calendar__note { padding: var(--tx-space-3) var(--tx-space-4); color: var(--tx-muted-foreground, GrayText); font-size: var(--tx-type-label-size); }
  .tx-calendar__sr-only { position: absolute; inline-size: 1px; block-size: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; margin: -1px; padding: 0; border: 0; }
  @media (max-width: 40rem) { .tx-calendar__header h2 { order: 1; flex-basis: 100%; } }
  @media (forced-colors: active) { .tx-calendar { border-color: CanvasText; } .tx-calendar__modes button[aria-pressed="true"] { border-color: Highlight; background: Highlight; color: HighlightText; } }
</style>
