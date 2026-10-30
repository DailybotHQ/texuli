<script lang="ts">
import { bindPointerGesture, createPointerTracker, type GestureEvent } from '@texuli/drag/gesture';
import { type Snippet, tick, untrack } from 'svelte';
import type { Attachment } from 'svelte/attachments';
import { type ClassValue, cx } from 'texuli/cx';
import type { MotionProp } from 'texuli/motion';
import { createLazyListMotion } from '../motion/lazy-list-motion.ts';
import { type DashboardWidgetEntry, setDashboardContext } from './context.ts';
import {
  addItem,
  cellFromDelta,
  type DashboardBreakpoint,
  type DashboardCompaction,
  type DashboardItem,
  type DashboardLayout,
  type DashboardMessagesOverrides,
  dashboardBreakpoints,
  dashboardKeyIntent,
  formatDashboardMessage,
  formatDashboardRefusal,
  layoutForBreakpoint,
  moveItem,
  normalizeBreakpoints,
  nudgeItem,
  positionValues,
  resizeItem,
  resolveBreakpoint,
  resolveDashboardMessages,
  sameLayout,
} from './engine/index.ts';
import { type DashboardLabelOverrides, DEFAULT_DASHBOARD_LABELS } from './labels.ts';

/**
 * A widget grid: `DashboardWidget` children placed on whole columns and
 * rows, moved and resized by pointer (through `@texuli/drag`) and by
 * keyboard on each widget's handles, with responsive breakpoints and a
 * serializable layout per breakpoint. Widgets paint in reading order.
 */
interface DashboardProps {
  /** Accessible name of the dashboard region. */
  label: string;
  /**
   * The layout of the widest breakpoint (the design). Bindable: a change
   * made at the widest breakpoint is written back.
   */
  layout?: DashboardLayout;
  /**
   * Saved layouts keyed by breakpoint id; they win over `layout`. Bindable:
   * every change is written to the active breakpoint's entry. Persist it
   * with `serializeDashboard` and read it back with `parseDashboard`.
   */
  layouts?: Readonly<Record<string, DashboardLayout>>;
  /** Columns of the widest grid (default 12); also shapes the default breakpoints. */
  columns?: number;
  /** Breakpoints, widest first (default `dashboardBreakpoints(columns)`). */
  breakpoints?: readonly DashboardBreakpoint[];
  /** Force a breakpoint by id instead of measuring the container (printing, previews, tests). */
  breakpoint?: string;
  /** Row height in CSS pixels (24 to 480, default 80). */
  rowHeight?: number;
  gap?: 'none' | 'small' | 'medium' | 'large';
  /** Shows the move and resize handles. Default false (a read-only dashboard). */
  editable?: boolean;
  /** `vertical` (default) floats widgets up; `none` keeps gaps. */
  compaction?: DashboardCompaction;
  /** Heading level of the widget titles (2 to 6, default 3). */
  headingLevel?: number;
  /** Called after every committed move or resize. */
  onLayoutChange?: (
    layout: DashboardLayout,
    detail: {
      breakpoint: string;
      widget: string;
      layouts: Readonly<Record<string, DashboardLayout>>;
    }
  ) => void;
  /** Announcement templates (any locale). */
  messages?: DashboardMessagesOverrides;
  labels?: DashboardLabelOverrides;
  /**
   * Motion (`texuli/motion`): widgets glide to their new cell after a change.
   * Instant under reduced motion and at level `none`; `false` turns it off.
   */
  motion?: MotionProp;
  dir?: 'ltr' | 'rtl';
  class?: ClassValue;
  /** `DashboardWidget` elements. */
  children?: Snippet;
}

let {
  label,
  layout = $bindable(),
  layouts = $bindable(),
  columns = 12,
  breakpoints,
  breakpoint: forced,
  rowHeight = 80,
  gap = 'medium',
  editable = false,
  compaction = 'vertical',
  headingLevel = 3,
  onLayoutChange,
  messages: messageOverrides,
  labels: labelOverrides,
  motion,
  dir,
  class: className,
  children,
}: DashboardProps = $props();

const uid = $props.id();
const rootId = `tx-dashboard-${uid}`;
const moveHelpId = `${rootId}-move-help`;
const resizeHelpId = `${rootId}-resize-help`;

// ── Widgets ────────────────────────────────────────────────────────────
let entries = $state.raw<readonly DashboardWidgetEntry[]>([]);
setDashboardContext({
  register(entry) {
    // `untrack`: widgets register while this dashboard renders.
    untrack(() => {
      entries = [...entries, entry];
    });
    return () => {
      entries = entries.filter((other) => other !== entry);
    };
  },
});

const byId = $derived(new Map(entries.map((entry) => [entry.id, entry])));
const labels = $derived({ ...DEFAULT_DASHBOARD_LABELS, ...labelOverrides });
const messages = $derived(resolveDashboardMessages(messageOverrides));
const level = $derived(Math.min(6, Math.max(2, Math.trunc(headingLevel) || 3)));
const safeRow = $derived(
  Number.isFinite(rowHeight) ? Math.min(480, Math.max(24, Math.round(rowHeight))) : 80
);
const gapToken = $derived(['none', 'small', 'medium', 'large'].includes(gap) ? gap : 'medium');

// ── Breakpoints and layout ─────────────────────────────────────────────
let width = $state(0);
const points = $derived(normalizeBreakpoints(breakpoints ?? dashboardBreakpoints(columns)));
const widest = $derived(points[0] as DashboardBreakpoint);
const active = $derived.by((): DashboardBreakpoint => {
  const chosen = forced ? points.find((entry) => entry.id === forced) : undefined;
  if (chosen) return chosen;
  // Before the first measure (and on the server) the widest grid paints.
  return width > 0 ? resolveBreakpoint(width, points) : widest;
});

/** Widgets' own placements, the design when no layout is given. */
const placed = $derived(
  entries
    .filter((entry) => Number.isFinite(entry.place.x) && Number.isFinite(entry.place.y))
    .map((entry) => ({ id: entry.id, ...entry.place }))
);

const resolved = $derived.by((): DashboardLayout => {
  // The design: the given layout, plus the own place of every widget it does not know yet.
  const known = new Set((layout ?? []).map((item) => item.id));
  const design = layout ? [...layout, ...placed.filter((item) => !known.has(item.id))] : placed;
  const saved: Record<string, unknown> = { [widest.id]: design, ...(layouts ?? {}) };
  let next: DashboardLayout = layoutForBreakpoint(saved, active, points, compaction).filter(
    (item) => byId.has(item.id)
  );
  // Widgets the layout does not know yet are placed first-fit, in the order they were written.
  for (const entry of entries) {
    if (next.some((item) => item.id === entry.id)) continue;
    const { x: _x, y: _y, ...size } = entry.place;
    const added = addItem(next, { id: entry.id, ...size }, { columns: active.columns, compaction });
    if (added.ok) next = added.layout;
  }
  return next;
});

/** The working layout while a widget is picked up or dragged. */
let preview = $state.raw<DashboardLayout | null>(null);
const current = $derived(preview ?? resolved);
const options = $derived({ columns: active.columns, compaction });

// ── Layout motion ──────────────────────────────────────────────────────
const widgetMotion = createLazyListMotion({
  motion: () => motion,
  defaults: { layout: true, duration: 'fast' },
  items: () =>
    Array.from(
      document.getElementById(rootId)?.querySelectorAll<HTMLElement>('[data-dashboard-widget]') ??
        [],
      (element) => [element.dataset.widgetId ?? '', element] as const
    ),
});
$effect.pre(() => {
  void current;
  untrack(() => widgetMotion.measure());
});
$effect(() => {
  void current;
  untrack(() => widgetMotion.play());
});

// ── Announcements ──────────────────────────────────────────────────────
let announcement = $state('');
function announce(text: string): void {
  // Re-announce identical text: clear first, then set on the next frame of work.
  announcement = '';
  void tick().then(() => {
    announcement = text;
  });
}
const titleOf = (id: string) => byId.get(id)?.title ?? id;
const itemOf = (layoutValue: DashboardLayout, id: string) =>
  layoutValue.find((item) => item.id === id);

// ── Picking up, stepping, dropping ─────────────────────────────────────
type Mode = 'move' | 'resize';
let grab = $state<{ id: string; mode: Mode; origin: DashboardLayout } | null>(null);

function direction(node: Element | null): 'ltr' | 'rtl' {
  if (dir) return dir;
  return node?.closest('[dir]')?.getAttribute('dir') === 'rtl' ? 'rtl' : 'ltr';
}

function begin(id: string, mode: Mode): void {
  const item = itemOf(resolved, id);
  if (!editable || !item || item.locked) return;
  grab = { id, mode, origin: resolved };
  preview = resolved;
  const values = positionValues(item, titleOf(id));
  announce(
    formatDashboardMessage(mode === 'move' ? messages.pickedUp : messages.resizeStarted, values)
  );
}

async function step(dx: -1 | 0 | 1, dy: -1 | 0 | 1): Promise<void> {
  const held = grab;
  if (!held) return;
  const working = preview ?? held.origin;
  const item = itemOf(working, held.id);
  if (!item) return;
  const result =
    held.mode === 'move'
      ? nudgeItem(working, held.id, { dx, dy }, options)
      : resizeItem(working, held.id, { w: item.w + dx, h: item.h + dy }, options);
  const title = titleOf(held.id);
  if (!result.ok) {
    announce(formatDashboardRefusal(messages, result.reason, positionValues(item, title)));
    return;
  }
  const focused = document.activeElement?.id;
  preview = result.layout;
  announce(
    formatDashboardMessage(
      held.mode === 'move' ? messages.moved : messages.resized,
      positionValues(result.item, title)
    )
  );
  // A keyed move re-inserts the widget's element; keep focus where it was.
  await tick();
  if (focused && document.activeElement?.id !== focused) document.getElementById(focused)?.focus();
}

function commit(next: DashboardLayout, widget: string): void {
  const all = { ...(layouts ?? {}), [active.id]: next };
  layouts = all;
  if (active.id === widest.id) layout = next;
  onLayoutChange?.(next, { breakpoint: active.id, widget, layouts: all });
}

function finish(): void {
  const held = grab;
  if (!held) return;
  const next = preview ?? held.origin;
  grab = null;
  preview = null;
  if (!sameLayout(next, held.origin)) commit(next, held.id);
  const item = itemOf(next, held.id);
  if (item) {
    announce(
      formatDashboardMessage(
        held.mode === 'move' ? messages.dropped : messages.resizeDone,
        positionValues(item, titleOf(held.id))
      )
    );
  }
}

function cancel(): void {
  const held = grab;
  if (!held) return;
  grab = null;
  preview = null;
  const item = itemOf(held.origin, held.id);
  if (item)
    announce(formatDashboardMessage(messages.cancelled, positionValues(item, titleOf(held.id))));
}

function onHandleKey(event: KeyboardEvent, id: string, mode: Mode): void {
  const holding = grab?.id === id && grab.mode === mode;
  const intent = dashboardKeyIntent(event, {
    active: holding,
    dir: direction(event.currentTarget as Element),
  });
  if (!intent) return;
  if (intent.type === 'cancel' && intent.keepFocusMove) {
    cancel();
    return;
  }
  event.preventDefault();
  if (intent.type === 'grab') {
    if (grab) cancel();
    begin(id, mode);
  } else if (intent.type === 'step') {
    void step(intent.dx, intent.dy);
  } else if (intent.type === 'drop') {
    finish();
  } else {
    cancel();
  }
}

// ── Pointer drags (through @texuli/drag/gesture) ───────────────────────
let dragging = $state(false);

function cellSize(): { width: number; height: number } {
  const grid = document.getElementById(`${rootId}-grid`);
  if (!grid) return { width: 0, height: 0 };
  const style = getComputedStyle(grid);
  const columnGap = Number.parseFloat(style.columnGap) || 0;
  const rowGap = Number.parseFloat(style.rowGap) || 0;
  const cols = active.columns;
  const inner = grid.getBoundingClientRect().width;
  return { width: (inner - columnGap * (cols - 1)) / cols + columnGap, height: safeRow + rowGap };
}

/**
 * Pointer drag on a handle: a press without travel picks the widget up (the
 * non-drag alternative). Cached per widget and handle, so a new layout (new
 * item objects) never re-attaches a handle in the middle of a drag.
 */
const attachments = new Map<string, Attachment<HTMLElement>>();
function gesture(id: string, mode: Mode): Attachment<HTMLElement> {
  const key = `${mode}:${id}`;
  let cached = attachments.get(key);
  if (!cached) {
    cached = handleGesture(id, mode);
    attachments.set(key, cached);
  }
  return cached;
}

function handleGesture(id: string, mode: Mode): Attachment<HTMLElement> {
  return (node) => {
    let cell = { width: 0, height: 0 };
    let start: DashboardItem | null = null;
    let stopKeys: (() => void) | null = null;
    const update = (event: GestureEvent) => {
      const held = grab;
      if (!held || !start) return;
      const to = cellFromDelta(
        mode === 'move' ? { x: start.x, y: start.y } : { x: start.w, y: start.h },
        event.delta,
        cell,
        direction(node)
      );
      const result =
        mode === 'move'
          ? moveItem(held.origin, id, to, options)
          : resizeItem(held.origin, id, { w: to.x, h: to.y }, options);
      if (result.ok && !sameLayout(result.layout, preview ?? held.origin)) preview = result.layout;
    };
    const stop = () => {
      stopKeys?.();
      stopKeys = null;
      dragging = false;
    };
    const dispose = bindPointerGesture(
      node,
      createPointerTracker({
        onStart: (event) => {
          if (grab) cancel();
          begin(id, mode);
          start = itemOf(resolved, id) ?? null;
          if (!grab || !start) return;
          cell = cellSize();
          dragging = true;
          const doc = node.ownerDocument;
          const onKey = (key: KeyboardEvent) => {
            if (key.key !== 'Escape') return;
            key.preventDefault();
            stop();
            cancel();
          };
          doc.addEventListener('keydown', onKey, true);
          stopKeys = () => doc.removeEventListener('keydown', onKey, true);
          update(event);
        },
        onMove: update,
        onEnd: (event) => {
          if (!dragging) return;
          update(event);
          stop();
          finish();
        },
        onCancel: () => {
          if (!dragging) return;
          stop();
          cancel();
        },
        onClick: () => {
          // A click toggles the picked-up state; the toolbar then moves it.
          if (grab?.id === id && grab.mode === mode) finish();
          else {
            if (grab) cancel();
            begin(id, mode);
          }
        },
      }),
      { listenOn: node.closest<HTMLElement>('.tx-dashboard') ?? node }
    );
    return () => {
      stop();
      dispose();
    };
  };
}

// ── Scrolling content ──────────────────────────────────────────────────
/**
 * Widgets whose content overflows its box. Such a content box scrolls, so
 * it becomes a tab stop named by the widget title (axe
 * `scrollable-region-focusable`): keyboard users can reach and scroll it.
 * Content that fits stays out of the tab order.
 */
let overflowing = $state<Record<string, boolean>>({});
const scrollAttachments = new Map<string, Attachment<HTMLElement>>();
function scrollRegion(id: string): Attachment<HTMLElement> {
  let cached = scrollAttachments.get(id);
  if (!cached) {
    cached = (node) => {
      // `untrack`: the attachment runs in an effect, and this writes what it reads.
      const measure = () =>
        untrack(() => {
          overflowing[id] =
            node.scrollHeight > node.clientHeight + 1 || node.scrollWidth > node.clientWidth + 1;
        });
      measure();
      const resize = new ResizeObserver(measure);
      const mutation = new MutationObserver(measure);
      resize.observe(node);
      mutation.observe(node, { childList: true, subtree: true, characterData: true });
      return () => {
        resize.disconnect();
        mutation.disconnect();
      };
    };
    scrollAttachments.set(id, cached);
  }
  return cached;
}

const gridStyle = $derived({ columns: active.columns, row: `${safeRow}px` });
</script>

<section
  id={rootId}
  class={cx('tx-dashboard', dragging && 'tx-dashboard--dragging', className)}
  aria-label={label}
  data-breakpoint={active.id}
  data-gap={gapToken}
  {dir}
  bind:clientWidth={width}
>
  {#if editable}
    <p id={moveHelpId} class="tx-dashboard__sr-only">{formatDashboardMessage(messages.moveInstructions, {})}</p>
    <p id={resizeHelpId} class="tx-dashboard__sr-only">{formatDashboardMessage(messages.resizeInstructions, {})}</p>
  {/if}
  <!-- Widgets register here; each paints below, in reading order. -->
  {@render children?.()}
  {#if current.length === 0}
    <p class="tx-dashboard__empty">{labels.empty}</p>
  {:else}
    <ul
      id="{rootId}-grid"
      class="tx-dashboard__grid"
      role="list"
      style:--tx-dashboard-columns={gridStyle.columns}
      style:--tx-dashboard-row={gridStyle.row}
    >
      {#each current as item (item.id)}
        {@const entry = byId.get(item.id)}
        {@const title = entry?.title ?? item.id}
        {@const holding = grab?.id === item.id ? grab.mode : null}
        <li
          class="tx-dashboard__widget"
          data-dashboard-widget
          data-widget-id={item.id}
          data-held={holding ?? undefined}
          data-locked={item.locked ? 'true' : undefined}
          style:grid-column="{item.x + 1} / span {item.w}"
          style:grid-row="{item.y + 1} / span {item.h}"
        >
          <header class="tx-dashboard__header">
            <svelte:element this={`h${level}`} class="tx-dashboard__title" id="{rootId}-{item.id}-title">{title}</svelte:element>
            {#if editable && !item.locked}
              <button
                type="button"
                class="tx-dashboard__handle"
                id="{rootId}-{item.id}-move"
                data-dashboard-handle="move"
                aria-label={labels.moveHandle(title)}
                aria-describedby={moveHelpId}
                aria-pressed={holding === 'move'}
                onkeydown={(event) => onHandleKey(event, item.id, 'move')}
                {@attach gesture(item.id, 'move')}
              >
                <span aria-hidden="true">⠿</span>
              </button>
            {/if}
          </header>
          {#if holding}
            {@const resizing = holding === 'resize'}
            <div class="tx-dashboard__toolbar" role="group" aria-label={labels.toolbar(title)}>
              <button type="button" id="{rootId}-{item.id}-left" onclick={() => step(-1, 0)}>{resizing ? labels.narrower : labels.moveLeft}</button>
              <button type="button" id="{rootId}-{item.id}-right" onclick={() => step(1, 0)}>{resizing ? labels.wider : labels.moveRight}</button>
              <button type="button" id="{rootId}-{item.id}-up" onclick={() => step(0, -1)}>{resizing ? labels.shorter : labels.moveUp}</button>
              <button type="button" id="{rootId}-{item.id}-down" onclick={() => step(0, 1)}>{resizing ? labels.taller : labels.moveDown}</button>
              <button type="button" data-dashboard-done onclick={finish}>{labels.done}</button>
              <button type="button" data-dashboard-cancel onclick={cancel}>{labels.cancel}</button>
            </div>
          {/if}
          <!-- svelte-ignore a11y_no_noninteractive_tabindex -- overflowing content scrolls; keyboard users must reach it (WCAG 2.1.1). -->
          <div
            class="tx-dashboard__content"
            tabindex={overflowing[item.id] ? 0 : undefined}
            role={overflowing[item.id] ? 'group' : undefined}
            aria-labelledby={overflowing[item.id] ? `${rootId}-${item.id}-title` : undefined}
            {@attach scrollRegion(item.id)}
          >
            {@render entry?.content?.()}
          </div>
          {#if editable && !item.locked}
            <button
              type="button"
              class="tx-dashboard__resize"
              id="{rootId}-{item.id}-resize"
              data-dashboard-handle="resize"
              aria-label={labels.resizeHandle(title)}
              aria-describedby={resizeHelpId}
              aria-pressed={holding === 'resize'}
              onkeydown={(event) => onHandleKey(event, item.id, 'resize')}
              {@attach gesture(item.id, 'resize')}
            >
              <span aria-hidden="true">◢</span>
            </button>
          {/if}
        </li>
      {/each}
    </ul>
  {/if}
  <p class="tx-dashboard__sr-only" role="status" aria-live="polite" aria-atomic="true">{announcement}</p>
</section>

<style>
  @layer tx.components {
    .tx-dashboard {
      color: var(--tx-foreground, CanvasText);
      min-inline-size: 0;
      container-type: inline-size;
    }

    .tx-dashboard__sr-only {
      position: absolute;
      inline-size: 1px;
      block-size: 1px;
      padding: 0;
      margin: -1px;
      overflow: hidden;
      clip-path: inset(50%);
      white-space: nowrap;
      border: 0;
    }

    .tx-dashboard__grid {
      --tx-dashboard-gap: 1rem;
      display: grid;
      grid-template-columns: repeat(var(--tx-dashboard-columns, 12), minmax(0, 1fr));
      grid-auto-rows: var(--tx-dashboard-row, 80px);
      gap: var(--tx-dashboard-gap);
      margin: 0;
      padding: 0;
      list-style: none;
    }

    .tx-dashboard[data-gap='none'] .tx-dashboard__grid {
      --tx-dashboard-gap: 0;
    }

    .tx-dashboard[data-gap='small'] .tx-dashboard__grid {
      --tx-dashboard-gap: 0.5rem;
    }

    .tx-dashboard[data-gap='large'] .tx-dashboard__grid {
      --tx-dashboard-gap: 1.5rem;
    }

    .tx-dashboard__widget {
      position: relative;
      display: flex;
      flex-direction: column;
      min-inline-size: 0;
      min-block-size: 0;
      overflow: hidden;
      border: var(--tx-border-width-thin) solid var(--tx-border, CanvasText);
      border-radius: var(--tx-shape-radius-xl);
      background: var(--tx-card, Canvas);
      color: var(--tx-card-foreground, CanvasText);
    }

    .tx-dashboard__widget[data-held] {
      outline: var(--tx-focus-ring-width, 2px) solid var(--tx-ring, Highlight);
      outline-offset: 2px;
      z-index: 1;
    }

    .tx-dashboard--dragging {
      user-select: none;
    }

    .tx-dashboard__header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--tx-space-2);
      padding-block: var(--tx-space-2);
      padding-inline: var(--tx-space-3);
      border-block-end: var(--tx-border-width-thin) solid var(--tx-border, CanvasText);
    }

    .tx-dashboard__title {
      margin: 0;
      font-size: 0.9375rem;
      font-weight: 600;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .tx-dashboard__handle,
    .tx-dashboard__resize {
      display: inline-grid;
      place-items: center;
      min-inline-size: 24px;
      min-block-size: 24px;
      padding: 0;
      border: var(--tx-border-width-thin) solid transparent;
      border-radius: var(--tx-shape-radius-sm);
      background: transparent;
      color: var(--tx-muted-foreground, CanvasText);
      cursor: grab;
      touch-action: none;
      font: inherit;
    }

    .tx-dashboard__resize {
      position: absolute;
      inset-block-end: 0.125rem;
      inset-inline-end: 0.125rem;
      cursor: nwse-resize;
    }

    .tx-dashboard__resize:dir(rtl) span {
      display: inline-block;
      transform: scaleX(-1);
    }

    .tx-dashboard__handle:hover,
    .tx-dashboard__resize:hover,
    .tx-dashboard__handle[aria-pressed='true'],
    .tx-dashboard__resize[aria-pressed='true'] {
      border-color: var(--tx-border, CanvasText);
      background: var(--tx-muted, Canvas);
      color: var(--tx-foreground, CanvasText);
    }

    .tx-dashboard__handle:focus-visible,
    .tx-dashboard__resize:focus-visible,
    .tx-dashboard__content:focus-visible,
    .tx-dashboard__toolbar button:focus-visible {
      outline: var(--tx-focus-ring-width, 2px) solid var(--tx-ring, Highlight);
      outline-offset: 2px;
    }

    .tx-dashboard__toolbar {
      display: flex;
      flex-wrap: wrap;
      gap: var(--tx-space-1);
      padding-block: calc(var(--tx-space-unit) * 1.5);
      padding-inline: var(--tx-space-3);
      border-block-end: var(--tx-border-width-thin) solid var(--tx-border, CanvasText);
      background: var(--tx-muted, Canvas);
    }

    .tx-dashboard__toolbar button {
      min-block-size: 24px;
      padding-block: calc(var(--tx-space-unit) * 0.5);
      padding-inline: var(--tx-space-2);
      border: var(--tx-border-width-thin) solid var(--tx-border, CanvasText);
      border-radius: var(--tx-shape-radius-sm);
      background: var(--tx-background, Canvas);
      color: var(--tx-foreground, CanvasText);
      font: inherit;
      font-size: 0.8125rem;
      cursor: pointer;
    }

    .tx-dashboard__content {
      flex: 1 1 auto;
      min-block-size: 0;
      overflow: auto;
      padding: var(--tx-space-3);
    }

    .tx-dashboard__empty {
      margin: 0;
      padding: var(--tx-space-4);
      color: var(--tx-muted-foreground, CanvasText);
    }

    @media (forced-colors: active) {
      .tx-dashboard__widget,
      .tx-dashboard__handle,
      .tx-dashboard__resize {
        border-color: CanvasText;
      }

      .tx-dashboard__widget[data-held] {
        outline-color: Highlight;
      }
    }
  }
</style>
