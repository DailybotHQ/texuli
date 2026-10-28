<script lang="ts" generics="T extends TimelineItem">
import { createPointerTracker } from '@texuli/drag/gesture';
import { applyModifiers, restrictToAxis, snapToGrid } from '@texuli/drag/modifiers';
import { type ClassValue, cx } from 'texuli/cx';
import { addDays, daysBetween, type IsoDate } from '../engines/calendar/dates.ts';
import { createAxis, windowAxis } from '../engines/grid/virtual.ts';
import {
  cascade,
  criticalPath,
  type Dependency,
  durationDays,
  type ScheduleTask,
  type TaskChange,
  type TimelineItem,
  timelineModel,
} from '../engines/timeline/schedule.ts';
import {
  axisPixel,
  DAY_WIDTH,
  DEFAULT_TIMELINE_LABELS,
  dateOffset,
  HEADER_HEIGHT,
  progressValue,
  ROW_HEIGHT,
  type TimelineLabels,
  type TimelineZoom,
  timelineRange,
  ZOOMS,
} from './model.ts';

let {
  tasks = [],
  dependencies = [],
  label = 'Project timeline',
  zoom = $bindable('week' as TimelineZoom),
  now,
  direction = 'ltr',
  locale = 'en',
  loading = false,
  error = null,
  getTitle = (task: T) => String((task as T & { title?: unknown }).title ?? task.id),
  getProgress = (task: T) => {
    const value = (task as T & { progress?: unknown }).progress;
    return typeof value === 'number' ? value : undefined;
  },
  onReschedule,
  onOpen,
  onRetry,
  getGroup,
  maxRows = 500,
  labels: labelOverrides,
  class: className,
}: {
  tasks?: readonly T[];
  dependencies?: readonly Dependency[];
  label?: string;
  zoom?: TimelineZoom;
  /** Fixed instant for tests and stories; defaults to “today” in UTC. */
  now?: Date;
  direction?: 'ltr' | 'rtl';
  /** BCP 47 locale for axis ticks and task-bar date names (full month). */
  locale?: string;
  loading?: boolean;
  error?: unknown;
  getTitle?: (task: T) => string;
  getProgress?: (task: T) => number | undefined;
  onReschedule?: (changes: readonly TaskChange[]) => void | Promise<void>;
  onOpen?: (task: T) => void;
  onRetry?: () => void | Promise<void>;
  getGroup?: (task: T) => { id: string; label: string } | undefined;
  maxRows?: number;
  /** Every user-facing string; defaults keep the original English copy. */
  labels?: Partial<TimelineLabels>;
  class?: ClassValue;
} = $props();

const labels = $derived.by<TimelineLabels>(() => {
  const merged: TimelineLabels = { ...DEFAULT_TIMELINE_LABELS, ...labelOverrides };
  if (labelOverrides?.columns)
    merged.columns = { ...DEFAULT_TIMELINE_LABELS.columns, ...labelOverrides.columns };
  return merged;
});

const uid = $props.id();
const today = $derived((now ?? new Date()).toISOString().slice(0, 10) as IsoDate);
let milestonesOnly = $state(false);
const model = $derived(timelineModel(tasks, { getGroup, maxRows, milestonesOnly }));
const visibleTasks = $derived(model.visible as (T & ScheduleTask)[]);
const range = $derived(timelineRange(visibleTasks, today));
const width = $derived(DAY_WIDTH[zoom]);
const totalDays = $derived(Math.max(1, daysBetween(range.start, range.end) + 1));
const canvasWidth = $derived(totalDays * width);
const axis = $derived(createAxis({ count: visibleTasks.length, size: ROW_HEIGHT }));

let scroller = $state<HTMLDivElement | undefined>();
let scrollTop = $state(0);
let viewportHeight = $state(440);
let interaction = $state<{
  id: string;
  mode: 'move' | 'resize-start' | 'resize-end';
  original: ScheduleTask;
  draft: ScheduleTask;
} | null>(null);
let optimistic = $state<Record<string, { start: IsoDate; end: IsoDate }>>({});
let pending = $state<Record<string, true>>({});
let announcement = $state('');

const visible = $derived(windowAxis(axis, scrollTop, viewportHeight, 4));
const positionedTasks = $derived(
  visibleTasks.map((task) => ({ ...task, ...(optimistic[task.id] ?? {}) }))
);
const critical = $derived(new Set(criticalPath(positionedTasks, dependencies).critical));
const activePreview = $derived.by(() => {
  if (!interaction) return [] as TaskChange[];
  try {
    return cascade(positionedTasks, dependencies, {
      id: interaction.id,
      start: interaction.draft.start,
      end: interaction.draft.end,
    }).changes;
  } catch {
    return [] as TaskChange[];
  }
});
const previewById = $derived(new Map(activePreview.map((change) => [change.id, change])));
const dayTicks = $derived.by(() => {
  const step = zoom === 'day' ? 1 : zoom === 'week' ? 7 : zoom === 'month' ? 30 : 90;
  const marks: { date: IsoDate; offset: number }[] = [];
  for (let day = 0; day < totalDays; day += step) {
    const date = addDays(range.start, day);
    marks.push({ date, offset: day * width });
  }
  return marks;
});
const todayOffset = $derived(dateOffset(today, range.start) * width);

function scheduled(task: T & ScheduleTask): ScheduleTask {
  const change = previewById.get(task.id);
  return {
    ...task,
    start: optimistic[task.id]?.start ?? change?.start ?? task.start,
    end: optimistic[task.id]?.end ?? change?.end ?? task.end,
  };
}

function taskInlineStyle(task: T & ScheduleTask): string {
  const position = scheduled(task);
  const offset = dateOffset(position.start, range.start);
  const days = Math.max(task.milestone ? 0 : 1, daysBetween(position.start, position.end) + 1);
  const barWidth = task.milestone ? 12 : Math.max(width * 0.7, days * width);
  // Logical inset from the day offset: `dir` mirrors it, so the earliest
  // date sits at the inline start in RTL — the same side the mirrored SVG
  // arrows anchor at (axisPixel).
  const startPx = offset * width;
  return `inset-inline-start:${startPx}px;width:${barWidth}px`;
}

function begin(
  task: T & ScheduleTask,
  mode: 'move' | 'resize-start' | 'resize-end',
  event?: PointerEvent
): void {
  if (!onReschedule || pending[task.id]) return;
  // A second pointer (or a non-primary button) never takes over a running drag.
  if (event && !pointerTracker.down(event)) return;
  const current = positionedTasks.find((item) => item.id === task.id) ?? task;
  interaction = {
    id: task.id,
    mode,
    original: { ...current },
    draft: { ...current },
  };
  if (event) (event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId);
}

// Pointer drags run on @texuli/drag: the tracker owns the lifecycle (no
// threshold: a press starts the interaction, as before; one pointer;
// pointercancel = cancel), and modifiers are the time strategy: the travel
// keeps the inline axis and snaps to whole days.
const pointerTracker = createPointerTracker({
  threshold: 0,
  onMove: (event) => pointerMove(event.delta),
  onEnd: (event) => {
    pointerMove(event.delta);
    void commit();
  },
  // A press without travel still commits (a no-op), as the plain pointerup did.
  onClick: () => void commit(),
  onCancel: () => cancel(),
});

function pointerMove(travel: { x: number; y: number }): void {
  if (!interaction) return;
  const snapped = applyModifiers([restrictToAxis('x'), snapToGrid({ x: width, y: 0 })], travel);
  const rawDelta = Math.round(snapped.x / width);
  const delta = direction === 'rtl' ? -rawDelta : rawDelta;
  if (delta === 0) return;
  const { original, mode } = interaction;
  const next =
    mode === 'move'
      ? { ...original, start: addDays(original.start, delta), end: addDays(original.end, delta) }
      : mode === 'resize-start'
        ? { ...original, start: addDays(original.start, delta) }
        : { ...original, end: addDays(original.end, delta) };
  if (next.start <= next.end) interaction = { ...interaction, draft: next };
}

async function commit(): Promise<void> {
  if (!interaction || !onReschedule) return;
  const result = activePreview
    .map((change) => {
      const original = positionedTasks.find((task) => task.id === change.id);
      return {
        ...change,
        start: change.start ?? original?.start,
        end: change.end ?? original?.end,
      };
    })
    .filter((change): change is TaskChange & { start: IsoDate; end: IsoDate } =>
      Boolean(change.start && change.end)
    );
  interaction = null;
  if (result.length === 0) return;
  optimistic = {
    ...optimistic,
    ...Object.fromEntries(
      result.map((change) => [change.id, { start: change.start, end: change.end }])
    ),
  };
  pending = {
    ...pending,
    ...Object.fromEntries(result.map((change) => [change.id, true as const])),
  };
  announcement = labels.saving;
  try {
    await onReschedule(result);
    announcement = labels.saved(result.length);
  } catch {
    const next = { ...optimistic };
    for (const change of result) delete next[change.id];
    optimistic = next;
    announcement = labels.saveFailed;
  } finally {
    const nextPending = { ...pending };
    for (const change of result) delete nextPending[change.id];
    pending = nextPending;
  }
}

function cancel(): void {
  interaction = null;
  announcement = labels.cancelled;
}

function keyTask(task: T & ScheduleTask, event: KeyboardEvent): void {
  if (!onReschedule) return;
  if (!interaction || interaction.id !== task.id) {
    if (event.key === ' ') {
      event.preventDefault();
      begin(task, event.shiftKey ? 'resize-end' : 'move');
      announcement = labels.pickedUp(getTitle(task));
    }
    return;
  }
  event.preventDefault();
  if (event.key === 'Escape') {
    cancel();
    return;
  }
  if (event.key === 'Enter' || event.key === ' ') {
    void commit();
    return;
  }
  if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
  const logicalRight = direction === 'rtl' ? 'ArrowLeft' : 'ArrowRight';
  const delta = event.key === logicalRight ? 1 : -1;
  const current = interaction;
  const { draft, mode } = current;
  const next =
    mode === 'move'
      ? { ...draft, start: addDays(draft.start, delta), end: addDays(draft.end, delta) }
      : mode === 'resize-start'
        ? { ...draft, start: addDays(draft.start, delta) }
        : { ...draft, end: addDays(draft.end, delta) };
  if (next.start <= next.end) {
    interaction = { ...current, draft: next };
    announcement = labels.preview(getTitle(task), formatDate(next.start), formatDate(next.end));
  }
}

function onScroll(event: Event): void {
  const element = event.currentTarget as HTMLDivElement;
  scrollTop = element.scrollTop;
  viewportHeight = element.clientHeight || 440;
}

/** Full month names in `locale` so task bars announce e.g. "June 2, 2026". */
function formatDate(date: string): string {
  return new Intl.DateTimeFormat(locale, {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${date}T12:00:00Z`));
}

function tickWidth(): number {
  return Math.max(
    width,
    zoom === 'quarter' ? 80 : width * (zoom === 'week' ? 7 : zoom === 'month' ? 30 : 1)
  );
}
</script>

<section
  class={cx('tx-timeline', className)}
  data-timeline
  data-zoom={zoom}
  data-direction={direction}
  dir={direction}
  aria-label={label}
>
  <header class="toolbar">
    <h2>{label}</h2>
    <button
      type="button"
      aria-pressed={milestonesOnly}
      onclick={() => (milestonesOnly = !milestonesOnly)}
    >
      {milestonesOnly ? labels.showAllTasks : labels.milestonesOnly}
    </button>
    <div class="zooms" role="group" aria-label={labels.zoomGroup}>
      {#each ZOOMS as option (option)}
        <button
          type="button"
          aria-pressed={zoom === option}
          onclick={() => (zoom = option)}
        >
          {option[0]?.toUpperCase()}{option.slice(1)}
        </button>
      {/each}
    </div>
  </header>

  {#if loading}
    <p class="status" role="status">{labels.loading}</p>
  {:else if error}
    <p class="status" role="alert">
      {labels.loadError}
      {#if onRetry}
        <button type="button" onclick={() => void onRetry()}>{labels.retry}</button>
      {/if}
    </p>
  {:else}
    {#if model.truncatedCount > 0}
      <p class="notice" role="status">
        {labels.truncated(model.visible.length, model.totalScheduled, model.truncatedCount)}
      </p>
    {/if}
    {#if milestonesOnly}
      <p class="notice" role="status">
        {labels.milestonesNotice}
        <button type="button" onclick={() => (milestonesOnly = false)}>{labels.showAll}</button>
      </p>
    {/if}
    {#if model.unscheduled.length > 0}
      <aside class="unscheduled" aria-label={labels.unscheduledTray}>
        <h3>{labels.unscheduledHeading} <span>{model.unscheduled.length}</span></h3>
        <ul>
          {#each model.unscheduled as task (task.id)}
            <li>
              <button type="button" onclick={() => onOpen?.(task as T)}>{getTitle(task as T)}</button>
            </li>
          {/each}
        </ul>
      </aside>
    {/if}
    {#if visibleTasks.length > 0}
      <div class="body" class:has-interaction={!!interaction}>
        <div
          class="task-table"
          role="table"
          aria-label={labels.tasksTable(label)}
          aria-colcount="4"
          aria-rowcount={visibleTasks.length + 1}
        >
          <div class="table-head" role="row" aria-rowindex="1">
            <span role="columnheader">{labels.columns.task}</span>
            <span role="columnheader">{labels.columns.start}</span>
            <span role="columnheader">{labels.columns.end}</span>
            <span role="columnheader">{labels.columns.duration}</span>
          </div>
          <div class="table-viewport" style:block-size="{Math.max(ROW_HEIGHT, viewportHeight)}px">
            {#each visible.items as row (visibleTasks[row.index]?.id)}
              {@const task = visibleTasks[row.index] as T & ScheduleTask}
              {@const dates = scheduled(task)}
              <div
                class="table-row"
                role="row"
                aria-rowindex={row.index + 2}
                style:inset-block-start="{row.start - scrollTop}px"
                style:block-size="{row.size}px"
                data-task-row={task.id}
              >
                <span role="cell" class="task-name" title={getTitle(task)}>
                  {#if getGroup}
                    <span class="group-label">{getGroup(task)?.label}</span>
                  {/if}
                  {#if critical.has(task.id)}
                    <span class="critical-mark" aria-label={labels.criticalPath}>●</span>
                  {/if}
                  {getTitle(task)}
                </span>
                <span role="cell">{dates.start}</span>
                <span role="cell">{dates.end}</span>
                <span role="cell"
                  >{labels.duration(durationDays(dates), task.milestone === true)}</span
                >
              </div>
            {/each}
          </div>
        </div>
        <div class="canvas-scroll" bind:this={scroller} onscroll={onScroll}>
          <div
            class="canvas"
            style:inline-size="{canvasWidth}px"
            style:block-size="{Math.max(ROW_HEIGHT, axis.total + HEADER_HEIGHT)}px"
          >
            <div class="date-head" style:block-size="{HEADER_HEIGHT}px">
              {#each dayTicks as tick (tick.date)}
                <span
                  style:inset-inline-start="{tick.offset}px"
                  style:inline-size="{tickWidth()}px"
                >
                  {formatDate(tick.date)}
                </span>
              {/each}
            </div>
            {#if todayOffset >= 0 && todayOffset <= canvasWidth}
              <div
                class="today-line"
                data-today-line
                role="img"
                style:inset-inline-start="{todayOffset}px"
                style:inset-block-start="{HEADER_HEIGHT}px"
                style:block-size="{axis.total}px"
                aria-label={`${labels.todayLabel}, ${formatDate(today)}`}
              >
                <span class="today-chip" aria-hidden="true">{labels.todayLabel}</span>
              </div>
            {/if}
            <svg
              class="dependencies"
              aria-hidden="true"
              style:inset-block-start="{HEADER_HEIGHT}px"
              style:inline-size="{canvasWidth}px"
              style:block-size="{axis.total}px"
            >
              <defs>
                <marker
                  id={`${uid}-dependency-arrow`}
                  markerWidth="7"
                  markerHeight="7"
                  refX="6"
                  refY="3.5"
                  orient="auto"
                >
                  <path d="M0,0 L7,3.5 L0,7 z" />
                </marker>
              </defs>
              {#each dependencies as dependency (`${dependency.from}:${dependency.to}`)}
                {@const fromIndex = visibleTasks.findIndex((task) => task.id === dependency.from)}
                {@const toIndex = visibleTasks.findIndex((task) => task.id === dependency.to)}
                {@const fromTask = positionedTasks.find((task) => task.id === dependency.from)}
                {@const toTask = positionedTasks.find((task) => task.id === dependency.to)}
                {#if fromIndex >= visible.start && fromIndex < visible.end && toIndex >= visible.start && toIndex < visible.end && fromTask && toTask}
                  {@const fromChange = previewById.get(dependency.from)}
                  {@const toChange = previewById.get(dependency.to)}
                  {@const fromEnd = fromChange?.end ?? fromTask.end}
                  {@const toStart = toChange?.start ?? toTask.start}
                  {@const x1 =
                    axisPixel(dateOffset(fromEnd, range.start), width, canvasWidth, direction) +
                    (direction === 'rtl' ? -width / 2 : width / 2)}
                  {@const x2 =
                    axisPixel(dateOffset(toStart, range.start), width, canvasWidth, direction) +
                    (direction === 'rtl' ? -2 : 2)}
                  <path
                    marker-end={`url(#${uid}-dependency-arrow)`}
                    d={`M ${x1} ${fromIndex * ROW_HEIGHT + ROW_HEIGHT / 2} C ${x1 + (direction === 'rtl' ? -width : width)} ${fromIndex * ROW_HEIGHT + ROW_HEIGHT / 2}, ${x2} ${toIndex * ROW_HEIGHT + ROW_HEIGHT / 2}, ${x2} ${toIndex * ROW_HEIGHT + ROW_HEIGHT / 2}`}
                  />
                {/if}
              {/each}
            </svg>
            {#each visible.items as row (visibleTasks[row.index]?.id)}
              {@const task = visibleTasks[row.index] as T & ScheduleTask}
              {@const change = previewById.get(task.id)}
              {@const shown = scheduled(task)}
              <div
                class="bar-row"
                style:inset-block-start="{row.start + HEADER_HEIGHT}px"
                style:block-size="{row.size}px"
              >
                <button
                  type="button"
                  class={cx(
                    'task-bar',
                    critical.has(task.id) && 'critical',
                    task.milestone && 'milestone',
                    change && 'preview'
                  )}
                  style={taskInlineStyle(task)}
                  aria-label={`${getTitle(task)}, ${formatDate(shown.start)} to ${formatDate(shown.end)}${task.milestone ? `, ${labels.milestoneSuffix}` : ''}${pending[task.id] ? `, ${labels.savingSuffix}` : ''}`}
                  aria-roledescription={labels.reschedulableTask}
                  aria-busy={pending[task.id] ? 'true' : undefined}
                  aria-pressed={interaction?.id === task.id}
                  disabled={!!pending[task.id]}
                  onpointerdown={(event) => begin(task, 'move', event)}
                  onpointermove={(event) => pointerTracker.move(event)}
                  onpointerup={(event) => pointerTracker.up(event)}
                  onpointercancel={(event) => pointerTracker.cancel(event)}
                  onkeydown={(event) => keyTask(task, event)}
                  onclick={() => onOpen?.(task)}
                >
                  <span class="progress" style:inline-size="{progressValue(getProgress(task))}%"
                  ></span>
                  <span class="bar-label">
                    {getTitle(task)}{task.milestone ? ` · ${labels.milestoneSuffix}` : ''}{pending[task.id]
                      ? ` · ${labels.savingSuffix}`
                      : ''}
                  </span>
                  <span
                    class="resize start"
                    role="presentation"
                    onpointerdown={(event) => {
                      event.stopPropagation();
                      begin(task, 'resize-start', event);
                    }}
                  ></span>
                  <span
                    class="resize end"
                    role="presentation"
                    onpointerdown={(event) => {
                      event.stopPropagation();
                      begin(task, 'resize-end', event);
                    }}
                  ></span>
                </button>
              </div>
            {/each}
          </div>
        </div>
      </div>
    {:else if !loading}
      <p class="status" role="status">{labels.empty}</p>
    {/if}
  {/if}
  <p class="sr-only" aria-live="polite">{announcement}</p>
</section>

<style>
  .tx-timeline {
    --tx-tl-line: var(--tx-border, ButtonBorder);
    --tx-tl-ink: var(--tx-foreground, CanvasText);
    --tx-tl-muted: var(--tx-muted-foreground, GrayText);
    --tx-tl-surface: var(--tx-surface, Canvas);
    --tx-tl-accent: var(--tx-primary, Highlight);
    --tx-tl-accent-fg: var(--tx-primary-foreground, HighlightText);
    --tx-tl-critical: var(--tx-destructive, Mark);
    /* The contract pairs destructiveForeground with destructive, so the
       critical bar stays AA in every theme without hardcoded colors. */
    --tx-tl-critical-fg: var(--tx-destructive-foreground, MarkText);
    color: var(--tx-tl-ink);
    background: var(--tx-tl-surface);
    border: 1px solid var(--tx-tl-line);
    border-radius: 0.75rem;
    overflow: hidden;
    font: inherit;
  }
  .toolbar {
    display: flex;
    flex-wrap: wrap;
    justify-content: space-between;
    align-items: center;
    gap: 1rem;
    padding-block: 0.75rem;
    padding-inline: 1rem;
    border-block-end: 1px solid var(--tx-tl-line);
  }
  h2 {
    font-size: 1rem;
    margin: 0;
  }
  .zooms {
    display: flex;
    gap: 0.25rem;
  }
  .zooms button,
  .toolbar > button,
  .notice button,
  .unscheduled button,
  .status button {
    background: transparent;
    border: 1px solid var(--tx-tl-line);
    border-radius: 0.375rem;
    padding-block: 0.3rem;
    padding-inline: 0.55rem;
    color: inherit;
    cursor: pointer;
  }
  .zooms button[aria-pressed='true'],
  .toolbar > button[aria-pressed='true'] {
    background: var(--tx-tl-accent);
    border-color: var(--tx-tl-accent);
    color: var(--tx-tl-accent-fg);
  }
  .tx-timeline :global(button:focus-visible) {
    outline: var(--tx-focus-ring-width, 2px) solid var(--tx-ring, Highlight);
    outline-offset: var(--tx-focus-ring-offset, 2px);
  }
  .body {
    display: grid;
    grid-template-columns: minmax(20rem, 45%) minmax(0, 1fr);
    block-size: min(32rem, 70vh);
    min-block-size: 18rem;
  }
  .task-table {
    border-inline-end: 1px solid var(--tx-tl-line);
    min-inline-size: 0;
    min-block-size: 0;
  }
  .table-head,
  .table-row {
    display: grid;
    /* Shrinkable date tracks: on a 360px screen the cells ellipsize instead
       of the End and Duration columns clipping away. */
    grid-template-columns: minmax(6rem, 1fr) minmax(4.5rem, 7.2rem) minmax(4.5rem, 7.2rem)
      minmax(3.5rem, 5.6rem);
    align-items: center;
    gap: 0.4rem;
    padding-inline: 0.65rem;
  }
  .table-head {
    block-size: 3rem;
    font-size: 0.72rem;
    color: var(--tx-tl-muted);
    font-weight: 600;
    border-block-end: 1px solid var(--tx-tl-line);
  }
  .table-viewport {
    position: relative;
    overflow: hidden;
  }
  .table-row {
    position: absolute;
    inset-inline: 0;
    border-block-end: 1px solid color-mix(in srgb, var(--tx-tl-line) 65%, transparent);
    font-size: 0.72rem;
    white-space: nowrap;
  }
  .table-row > span,
  .table-head span {
    min-inline-size: 0;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .task-name {
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .critical-mark {
    color: var(--tx-tl-critical);
    font-size: 0.65rem;
    margin-inline-end: 0.35rem;
  }
  .group-label {
    color: var(--tx-tl-muted);
    margin-inline-end: 0.35rem;
  }
  .canvas-scroll {
    min-inline-size: 0;
    min-block-size: 0;
    overflow: auto;
    position: relative;
    block-size: 100%;
  }
  .canvas {
    position: relative;
    min-block-size: 100%;
  }
  .date-head {
    position: sticky;
    inset-block-start: 0;
    z-index: 4;
    background: var(--tx-tl-surface);
    border-block-end: 1px solid var(--tx-tl-line);
    white-space: nowrap;
    overflow: hidden;
  }
  .date-head span {
    position: absolute;
    inset-block: 0;
    display: flex;
    align-items: center;
    padding-inline-start: 0.45rem;
    border-inline-start: 1px solid var(--tx-tl-line);
    font-size: 0.7rem;
    color: var(--tx-tl-muted);
  }
  .today-line {
    position: absolute;
    border-inline-start: 2px solid var(--tx-tl-critical);
    z-index: 3;
    pointer-events: none;
  }
  .today-chip {
    position: absolute;
    inset-block-start: 0;
    inset-inline-start: 0.15rem;
    font-size: 0.62rem;
    color: var(--tx-tl-critical);
    white-space: nowrap;
  }
  .dependencies {
    position: absolute;
    inset-inline-start: 0;
    overflow: visible;
    pointer-events: none;
    z-index: 1;
  }
  .dependencies path {
    fill: none;
    stroke: var(--tx-tl-muted);
    stroke-width: 1.5;
    stroke-dasharray: 3 2;
  }
  .dependencies marker path {
    fill: var(--tx-tl-muted);
    stroke: none;
  }
  .bar-row {
    position: absolute;
    inset-inline: 0;
    border-block-end: 1px solid color-mix(in srgb, var(--tx-tl-line) 65%, transparent);
    z-index: 2;
  }
  .task-bar {
    position: absolute;
    inset-block-start: 7px;
    block-size: 29px;
    display: flex;
    align-items: center;
    border: 1px solid var(--tx-tl-accent);
    border-radius: 0.35rem;
    background: color-mix(in srgb, var(--tx-tl-accent) 12%, var(--tx-tl-surface));
    color: var(--tx-tl-ink);
    text-align: start;
    overflow: hidden;
    padding-inline: 0.35rem;
    touch-action: none;
    cursor: grab;
  }
  .task-bar:active {
    cursor: grabbing;
  }
  .task-bar.critical {
    border-color: var(--tx-tl-critical);
    /* Solid destructive fill; its contract foreground keeps labels AA. */
    background: var(--tx-tl-critical);
    color: var(--tx-tl-critical-fg);
  }
  .task-bar.preview {
    outline: 2px dashed var(--tx-tl-accent);
    outline-offset: 1px;
  }
  .task-bar.milestone {
    border-radius: 0;
    transform: rotate(45deg);
    block-size: 14px;
    inset-block-start: 14px;
    background: var(--tx-tl-critical);
    border-color: var(--tx-tl-critical);
  }
  .progress {
    position: absolute;
    inset-block: 0;
    inset-inline-start: 0;
    background: color-mix(in srgb, var(--tx-tl-accent) 20%, transparent);
    pointer-events: none;
  }
  /* On the solid critical fill, progress is a stripe on the block-end edge:
     a tint behind the label would pull the fill toward the label color and
     break AA (T-87). */
  .critical .progress {
    inset-block: auto 0;
    block-size: 3px;
    background: var(--tx-tl-critical-fg);
  }
  .bar-label {
    position: relative;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 0.7rem;
    font-weight: var(--tx-font-weight-semibold, 600);
    color: inherit;
    pointer-events: none;
  }
  .milestone .bar-label {
    display: none;
  }
  .resize {
    position: absolute;
    inset-block: 0;
    inline-size: 7px;
    cursor: ew-resize;
  }
  .resize.start {
    inset-inline-start: 0;
  }
  .resize.end {
    inset-inline-end: 0;
  }
  @media (forced-colors: active) {
    .zooms button[aria-pressed='true'],
    .toolbar > button[aria-pressed='true'] {
      border-color: Highlight;
      background: Highlight;
      color: HighlightText;
    }
    /* Critical stays distinguishable by a heavier system-color border; the
       progress stripe opts out of forcing so it is not erased to Canvas. */
    .task-bar.critical {
      border: 2px solid CanvasText;
      background: Canvas;
      color: CanvasText;
    }
    .critical .progress {
      forced-color-adjust: none;
      background: CanvasText;
    }
  }
  .notice,
  .unscheduled,
  .status {
    padding-block: 0.5rem;
    padding-inline: 0.75rem;
    border-block-end: 1px solid var(--tx-tl-line);
  }
  .unscheduled h3 {
    font-size: 0.8rem;
    margin: 0 0 0.35rem;
  }
  .unscheduled ul {
    display: flex;
    flex-wrap: wrap;
    gap: 0.35rem;
    list-style: none;
    margin: 0;
    padding: 0;
  }
  .sr-only {
    position: absolute;
    inline-size: 1px;
    block-size: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }
  @media (max-width: 767px) {
    .body {
      display: block;
      block-size: auto;
      min-block-size: 0;
    }
    .task-table {
      border: 0;
    }
    .table-viewport {
      block-size: auto !important;
    }
    .table-row {
      position: static !important;
      display: grid;
      min-block-size: 3rem;
    }
    .task-name {
      white-space: normal;
    }
    .canvas-scroll {
      display: none;
    }
  }
</style>
