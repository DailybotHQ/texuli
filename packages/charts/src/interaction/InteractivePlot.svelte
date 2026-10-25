<script lang="ts" generics="D">
import type { Snippet } from 'svelte';
import type { Rect } from '../math/types.ts';
import {
  type ActivePoint,
  type BrushRange,
  brushToDomain,
  type ChartCrosshair,
  type ChartFormatters,
  type ChartSelection,
  clampZoomDomain,
  type DomainPair,
  edgeIndex,
  firstActive,
  nearestIndex,
  nearestPoint2d,
  normalizeBrush,
  type PlotPoint,
  type PlotSeries,
  prefersReducedMotion,
  seriesColor,
  stepIndex,
  stepSeries,
  zoomDomain,
} from './model.ts';
import TooltipCrosshairLayer from './TooltipCrosshairLayer.svelte';
import './interaction.css';

type Props = {
  /** Accessible name of the plot (usually the chart title). */
  label: string;
  /**
   * Prefer title/description element ids so the graphics region stays
   * `role="img"` named by the chart title (and described by the caption).
   */
  labelledBy?: string;
  describedBy?: string;
  series: readonly PlotSeries<D>[];
  hidden?: ReadonlySet<string>;
  width: number;
  height: number;
  plot: Rect;
  formatters: ChartFormatters;
  /** Enter, Space or a click on the active point; use it for drill-down. */
  onselect?: (selection: ChartSelection<D>) => void;
  /** Vertical guide at the active x, or none. */
  crosshair?: ChartCrosshair;
  /**
   * `x` (default): points run left to right and the pointer picks the nearest x.
   * `y`: points run top to bottom (horizontal bars) and the pointer picks the nearest y.
   */
  orientation?: 'x' | 'y';
  /** Custom pointer lookup (e.g. a scatter grid index); return null for "nothing here". */
  hitTest?: (x: number, y: number) => ActivePoint | null;
  tooltip?: boolean;
  /**
   * When set, Shift+drag brushes along the axis and calls with the domain.
   * Pass a scale invert: pixel → domain.
   */
  brushInvert?: (pixel: number) => number;
  /** Full domain used to clamp zoom/brush results. */
  fullDomain?: DomainPair;
  /** Zoom factor on wheel (with Ctrl/Meta); omit to disable wheel zoom. */
  onzoom?: (domain: DomainPair) => void;
  onbrush?: (domain: DomainPair, pixels: BrushRange) => void;
  /** The chart's marks (bars, lines…) in the same pixel space. */
  children?: Snippet;
};

let {
  label,
  labelledBy,
  describedBy,
  series,
  hidden = new Set<string>(),
  width,
  height,
  plot,
  formatters,
  onselect,
  crosshair = 'x',
  orientation = 'x',
  hitTest,
  tooltip = true,
  brushInvert,
  fullDomain,
  onzoom,
  onbrush,
  children,
}: Props = $props();

const uid = $props.id();
const keyboardHintId = $derived(`${uid}-keys`);
const resolvedDescribedBy = $derived(
  [describedBy, keyboardHintId].filter(Boolean).join(' ') || undefined
);

let active = $state<ActivePoint | null>(null);
let hover = $state<ActivePoint | null>(null);
let focused = $state(false);
let dismissed = $state(false);
let announcement = $state('');
let brush = $state<BrushRange | null>(null);
let brushing = $state(false);
let brushOrigin = $state<number | null>(null);
let explorerEl = $state<HTMLElement | null>(null);
let svgEl = $state<SVGSVGElement | null>(null);

function focusExplorer(): void {
  explorerEl?.focus();
}

const reduceMotion = $derived(prefersReducedMotion());

// For horizontal layouts, look points up along y by swapping the axes once per data change.
const lookup = $derived(
  orientation === 'y'
    ? series.map((s) =>
        s.points.map((p) => ({
          ...p,
          x: p.y ?? Number.NaN,
          y: Number.isFinite(p.x) ? p.x : null,
        }))
      )
    : series.map((s) => s.points)
);
const along = (p: PlotPoint<D>) => (orientation === 'y' ? (p.y ?? Number.NaN) : p.x);

const colorOf = (k: number) => series[k]?.color ?? seriesColor(k);
const pointAt = (a: ActivePoint | null): PlotPoint<D> | undefined =>
  a ? series[a.series]?.points[a.index] : undefined;
const colorOfPoint = (a: ActivePoint, point: PlotPoint<D>) => point.color ?? colorOf(a.series);

// Keep the active point valid when series, data or visibility change.
$effect.pre(() => {
  const current = active;
  if (!current) return;
  const s = series[current.series];
  const p = s?.points[current.index];
  if (!s || hidden.has(s.id) || !p || p.y === null) active = firstActive(series, hidden);
});

const shown = $derived(hover ?? (focused ? active : null));
const shownPoint = $derived(pointAt(shown));

function describe(a: ActivePoint): string {
  const s = series[a.series] as PlotSeries<D>;
  const p = s.points[a.index] as PlotPoint<D>;
  if (p.accessibleLabel) return p.accessibleLabel;
  const definedPts = s.points.filter((q) => q.y !== null);
  const position = definedPts.indexOf(p) + 1;
  return `${p.label ?? s.label}, ${formatters.x(p.xValue)}: ${formatters.y(p.yValue, s.id)}. Point ${position} of ${definedPts.length}.`;
}

/** Every visible series' value at the shown x, for the tooltip. */
const rows = $derived.by(() => {
  if (!shown || !shownPoint) return [];
  return series.flatMap((s, k) => {
    if (s.pointer === false || hidden.has(s.id)) return [];
    const i = k === shown.series ? shown.index : nearestIndex(lookup[k] ?? [], along(shownPoint));
    const p = s.points[i];
    if (!p || p.xValue !== shownPoint.xValue) return [];
    return [
      {
        id: s.id,
        label: p.label ?? s.label,
        color: p.color ?? colorOf(k),
        value: formatters.y(p.yValue, s.id),
        current: k === shown.series,
      },
    ];
  });
});

function setActive(next: ActivePoint) {
  active = next;
  dismissed = false;
  announcement = describe(next);
}

function onkeydown(event: KeyboardEvent) {
  const current = active ?? firstActive(series, hidden);
  if (!current) return;
  const points = (series[current.series] as PlotSeries<D>).points;
  let next: ActivePoint | null = null;
  switch (event.key) {
    case 'ArrowRight':
      next = { ...current, index: active ? stepIndex(points, current.index, 1) : current.index };
      break;
    case 'ArrowLeft':
      next = { ...current, index: active ? stepIndex(points, current.index, -1) : current.index };
      break;
    case 'Home':
      next = { ...current, index: edgeIndex(points, 1) };
      break;
    case 'End':
      next = { ...current, index: edgeIndex(points, -1) };
      break;
    case 'PageDown':
    case 'ArrowDown':
      next = stepSeries(series, hidden, current, 1);
      break;
    case 'PageUp':
    case 'ArrowUp':
      next = stepSeries(series, hidden, current, -1);
      break;
    case 'Enter':
    case ' ':
      event.preventDefault();
      if (active) select(active);
      return;
    case 'Escape':
      if (!dismissed || brush) {
        event.preventDefault();
        dismissed = true;
        hover = null;
        brush = null;
        brushing = false;
        brushOrigin = null;
      }
      return;
    case '+':
    case '=':
      if (onzoom && fullDomain && active) {
        event.preventDefault();
        const p = pointAt(active);
        if (p) {
          const center = typeof p.xValue === 'number' ? p.xValue : fullDomain[0];
          onzoom(zoomDomain(fullDomain, 0.8, center, fullDomain));
        }
      }
      return;
    case '-':
      if (onzoom && fullDomain && active) {
        event.preventDefault();
        const p = pointAt(active);
        if (p) {
          const center = typeof p.xValue === 'number' ? p.xValue : fullDomain[0];
          onzoom(zoomDomain(fullDomain, 1.25, center, fullDomain));
        }
      }
      return;
    default:
      return;
  }
  event.preventDefault();
  if (next && next.index >= 0) setActive(next);
}

function select(a: ActivePoint) {
  const s = series[a.series];
  const p = s?.points[a.index];
  if (s && p) onselect?.({ series: s, index: a.index, datum: p.datum });
}

/**
 * Pointer position in plot units (the SVG's viewBox). The SVG scales down to
 * fit narrow containers, so CSS pixels are converted back to plot pixels.
 */
function plotPoint(event: MouseEvent, box: SVGSVGElement | HTMLElement): [number, number] {
  const rect = box.getBoundingClientRect();
  const sx = rect.width > 0 ? width / rect.width : 1;
  const sy = rect.height > 0 ? height / rect.height : 1;
  return [(event.clientX - rect.left) * sx, (event.clientY - rect.top) * sy];
}

function axisPixel(event: MouseEvent, svg: SVGSVGElement | HTMLElement): number {
  const [px, py] = plotPoint(event, svg);
  return orientation === 'y' ? py : px;
}

/** Map pointer coordinates through the plot SVG's box (explorer may sit on top). */
function pointerTarget(): SVGSVGElement | HTMLElement {
  return svgEl ?? explorerEl ?? (document.body as HTMLElement);
}

/** The point under the pointer: the hit test, or the nearest position along the axis. */
function locate(event: MouseEvent): ActivePoint | null {
  const [px, py] = plotPoint(event, pointerTarget());
  if (hitTest) return hitTest(px, py);
  if (crosshair === 'xy') return nearestPoint2d(series, hidden, px, py);
  const [x, y] = orientation === 'y' ? [py, px] : [px, py];
  let best: ActivePoint | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;
  series.forEach((s, k) => {
    if (s.pointer === false || hidden.has(s.id)) return;
    const points = lookup[k] ?? [];
    const i = nearestIndex(points, x);
    const p = points[i];
    if (!p || p.y === null) return;
    const distance = Math.abs(p.x - x) * 1000 + Math.abs(p.y - y);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = { series: k, index: i };
    }
  });
  return best;
}

function onpointermove(event: PointerEvent) {
  if (brushing && brushOrigin !== null && brushInvert) {
    const px = axisPixel(event, pointerTarget());
    brush = normalizeBrush(brushOrigin, px);
    return;
  }
  hover = locate(event);
  dismissed = false;
}

function onpointerdown(event: PointerEvent) {
  if (event.shiftKey && brushInvert) {
    const target = event.currentTarget as HTMLElement;
    brushing = true;
    brushOrigin = axisPixel(event, pointerTarget());
    brush = normalizeBrush(brushOrigin, brushOrigin);
    target.setPointerCapture?.(event.pointerId);
    return;
  }
  onpointermove(event);
}

function onpointerup(event: PointerEvent) {
  if (brushing && brush && brushInvert && onbrush) {
    const domain = brushToDomain(brush, brushInvert);
    const clamped = fullDomain ? clampZoomDomain(domain, fullDomain) : domain;
    onbrush(clamped, brush);
  }
  brushing = false;
  brushOrigin = null;
  const target = event.currentTarget as HTMLElement;
  try {
    target.releasePointerCapture?.(event.pointerId);
  } catch {
    /* already released */
  }
}

/**
 * A click selects the point under it. Taps have no pointermove first, so the
 * click locates its own point instead of relying on hover. Focus moves to the
 * keyboard explorer so arrow keys continue from this selection.
 */
function onclick(event: MouseEvent) {
  if (event.shiftKey && brushInvert) return;
  const target = event.detail === 0 ? hover : (locate(event) ?? hover);
  if (!target) return;
  hover = target;
  dismissed = false;
  setActive(target);
  select(target);
  focusExplorer();
}

function onwheel(event: WheelEvent) {
  if (!onzoom || !fullDomain) return;
  if (!(event.ctrlKey || event.metaKey)) return;
  event.preventDefault();
  if (reduceMotion) return;
  const [plotX, plotY] = plotPoint(event, pointerTarget());
  const px = orientation === 'y' ? plotY : plotX;
  // Approximate center in domain space via nearest point when no invert; else brushInvert.
  let center = (fullDomain[0] + fullDomain[1]) / 2;
  if (brushInvert) center = brushInvert(px);
  const factor = event.deltaY > 0 ? 1.15 : 0.87;
  onzoom(zoomDomain(fullDomain, factor, center, fullDomain));
}

function onExplorerFocus() {
  focused = true;
  if (!active) {
    const first = firstActive(series, hidden);
    if (first) setActive(first);
  } else announcement = describe(active);
}

function onExplorerBlur() {
  focused = false;
}

const brushRect = $derived.by(() => {
  if (!brush) return null;
  if (orientation === 'y') {
    return {
      x: plot.x,
      y: brush.start,
      width: plot.width,
      height: Math.max(1, brush.end - brush.start),
    };
  }
  return {
    x: brush.start,
    y: plot.y,
    width: Math.max(1, brush.end - brush.start),
    height: plot.height,
  };
});
</script>

<div
  class="tx-chart-plot"
  style={`max-inline-size: ${width}px; aspect-ratio: ${width} / ${height}`}
  data-chart-plot=""
  data-reduced-motion={reduceMotion ? 'true' : undefined}
>
  <!--
    Named graphics region (role=img): title/description only — no keyboard
    composite props. Keyboard exploration lives on a sibling application
    surface that supports aria-activedescendant without nested role=img.
  -->
  <svg
    direction="ltr"
    bind:this={svgEl}
    {width}
    {height}
    viewBox="0 0 {width} {height}"
    role="img"
    aria-labelledby={labelledBy}
    aria-describedby={describedBy}
    aria-label={labelledBy ? undefined : label}
    class="tx-chart-plot__svg"
    data-chart-svg=""
  >
    {@render children?.()}

    {#if brushRect}
      <rect
        aria-hidden="true"
        data-chart-brush=""
        x={brushRect.x}
        y={brushRect.y}
        width={brushRect.width}
        height={brushRect.height}
        class="tx-chart-brush"
      />
    {/if}

  </svg>

  {#if shown && shownPoint && shownPoint.y !== null}
    <TooltipCrosshairLayer
      point={shownPoint}
      {rows}
      {plot}
      {width}
      {height}
      color={colorOfPoint(shown, shownPoint)}
      xLabel={formatters.x(shownPoint.xValue)}
      {crosshair}
      {orientation}
      activePoint={focused && active ? pointAt(active) : undefined}
      {tooltip}
      {dismissed}
    />
  {/if}

  <!--
    Keyboard/pointer explorer: role=application supports aria-activedescendant.
    Covers the plot; pointer handlers stay here so one surface owns interaction.
  -->
  <!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions -->
  <div
    bind:this={explorerEl}
    class="tx-chart-plot__explorer"
    role="application"
    aria-roledescription="chart"
    aria-labelledby={labelledBy}
    aria-describedby={resolvedDescribedBy}
    aria-label={labelledBy ? undefined : label}
    aria-activedescendant={focused && active ? `${uid}-point` : undefined}
    tabindex="0"
    data-chart-explorer=""
    {onkeydown}
    onfocus={onExplorerFocus}
    onblur={onExplorerBlur}
    {onpointermove}
    {onpointerdown}
    {onpointerup}
    onpointerleave={() => {
      hover = null;
      if (!brushing) brush = null;
    }}
    {onclick}
    {onwheel}
  >
    {#if focused && active}
      <span id="{uid}-point" class="tx-sr-only" data-active-point-label="">
        {describe(active)}
      </span>
    {/if}
  </div>

  <p class="tx-sr-only" id={keyboardHintId}>
    Use arrow keys to move between points, Page Up and Page Down to switch series, Enter to select.
    Shift-drag to brush; Ctrl-wheel or plus and minus to zoom when enabled.
  </p>
  <p class="tx-sr-only" aria-live="polite" data-chart-live="">{announcement}</p>
</div>
