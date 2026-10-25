<script lang="ts">
import {
  type CalendarTableLabels,
  calendarColorIndex,
  calendarFill,
  calendarLabels,
  createCalendarHeatmapLayout,
  formatCalendarDate,
  formatCalendarValue,
} from './model.ts';

type Props = {
  title: string;
  description: string;
  start: string | number;
  end: string | number;
  values?: Readonly<Record<string, number>> | ReadonlyMap<string, number>;
  weekStartsOn?: number;
  cellSize?: number;
  gap?: number;
  labels?: Partial<CalendarTableLabels>;
};

let {
  title,
  description,
  start,
  end,
  values,
  weekStartsOn = 1,
  cellSize = 12,
  gap = 2,
  labels,
}: Props = $props();

const uid = $props.id();
const text = $derived(calendarLabels(labels));
const layout = $derived(
  createCalendarHeatmapLayout({ start, end, values, weekStartsOn, cellSize, gap })
);
const months = $derived(
  layout.months.map((month) => ({
    ...month,
    x: layout.cells.find((cell) => cell.week === month.week)?.x ?? 0,
  }))
);
const labelOffset = 20;

$effect(() => {
  if (title.trim() === '') throw new TypeError('CalendarHeatmap needs a non-empty title.');
  if (description.trim() === '') {
    throw new TypeError('CalendarHeatmap needs an accessible description.');
  }
});
</script>

<figure class="calendar" data-kind="calendar">
  <figcaption>
    <h3>{title}</h3>
    <p>{description}</p>
  </figcaption>
  <svg
    direction="ltr"
    viewBox="0 0 {Math.max(1, layout.width)} {Math.max(1, layout.height + labelOffset)}"
    role="img"
    aria-labelledby="{uid}-title {uid}-description"
  >
    <title id="{uid}-title">{title}</title>
    <desc id="{uid}-description">{description}</desc>
    <g class="months" aria-hidden="true">
      {#each months as month (month.month)}
        <text x={month.x} y="12">{month.month.slice(5)}</text>
      {/each}
    </g>
    <g transform="translate(0 {labelOffset})" aria-hidden="true">
      {#each layout.cells as cell (cell.date)}
        {@const colorIndex = calendarColorIndex(cell.value, layout.cells)}
        <rect
          data-day={cell.date}
          data-value={cell.value ?? 'none'}
          x={cell.x}
          y={cell.y}
          width={cell.size}
          height={cell.size}
          rx="2"
          fill={calendarFill(colorIndex)}
        >
          <title>{formatCalendarDate(cell.date)}: {formatCalendarValue(cell.value, text.noData)}</title>
        </rect>
      {/each}
    </g>
  </svg>
  <details class="data-table">
    <summary>{text.table}</summary>
    <table>
      <caption>{title} data</caption>
      <thead><tr><th scope="col">{text.date}</th><th scope="col">{text.value}</th></tr></thead>
      <tbody>
        {#each layout.cells as cell (cell.date)}
          <tr><th scope="row">{formatCalendarDate(cell.date)}</th><td>{formatCalendarValue(cell.value, text.noData)}</td></tr>
        {/each}
      </tbody>
    </table>
  </details>
</figure>

<style>
  .calendar { color: var(--tx-foreground, CanvasText); margin: 0; max-inline-size: 100%; }
  figcaption h3 { font-size: 1rem; margin-block: 0; }
  figcaption p { color: var(--tx-muted-foreground, GrayText); margin-block: 0.25rem 0.75rem; }
  svg { display: block; inline-size: 100%; max-block-size: 16rem; overflow: visible; }
  .months text { fill: var(--tx-chart-axis, var(--tx-muted-foreground, GrayText)); font-size: 10px; }
  rect { stroke: var(--tx-background, Canvas); stroke-width: 0.75; }
  .data-table { margin-block-start: 0.75rem; }
  summary { cursor: pointer; min-block-size: 2.75rem; align-content: center; }
  table { border-collapse: collapse; inline-size: 100%; }
  th, td { border: 1px solid var(--tx-chart-grid, var(--tx-border, GrayText)); padding: 0.375rem 0.5rem; text-align: start; }
  @media (forced-colors: active) {
    figcaption p, .months text { color: CanvasText; fill: CanvasText; }
    rect { fill: Canvas; stroke: CanvasText; }
    rect[data-value]:not([data-value='none']) { fill: Highlight; }
  }
</style>
