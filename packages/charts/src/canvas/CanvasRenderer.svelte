<script lang="ts">
import {
  type CanvasChartKind,
  type CanvasSeries,
  downsampleCanvasPoints,
  drawCanvasChart,
} from './model.ts';

interface Props {
  kind: CanvasChartKind;
  series: readonly CanvasSeries[];
  width: number;
  height: number;
}

let { kind, series, width, height }: Props = $props();
let canvas: HTMLCanvasElement;

function paint(): void {
  if (!canvas) return;
  const context = canvas.getContext('2d');
  if (!context) return;
  const view = canvas.ownerDocument.defaultView;
  const ratio = Math.max(1, view?.devicePixelRatio ?? 1);
  const pixelWidth = Math.round(width * ratio);
  const pixelHeight = Math.round(height * ratio);
  if (canvas.width !== pixelWidth) canvas.width = pixelWidth;
  if (canvas.height !== pixelHeight) canvas.height = pixelHeight;
  context.setTransform(ratio, 0, 0, ratio, 0, 0);

  const computed = view?.getComputedStyle(canvas);
  const chartSeries = series.map((item, seriesIndex) => {
    const [, name, fallback] = item.color.match(/^var\((--[\w-]+)(?:,\s*(.+))?\)$/) ?? [];
    const color = name
      ? computed?.getPropertyValue(name).trim() || fallback || 'CanvasText'
      : item.color;
    const isBar =
      kind === 'bar' || kind === 'stacked-bar' || (kind === 'combo' && seriesIndex === 0);
    return {
      ...item,
      color,
      points: isBar ? item.points : downsampleCanvasPoints(item.points, width),
    };
  });
  drawCanvasChart(context, kind, chartSeries, width, height);
}

$effect(() => {
  // Re-run when the canvas node binds and whenever chart inputs change.
  if (!canvas) return;
  void kind;
  void series;
  void width;
  void height;
  paint();
});
</script>

<canvas bind:this={canvas} class="marks" width={width} height={height} aria-hidden="true"></canvas>

<style>
  .marks { display: block; inline-size: 100%; block-size: auto; inset: 0; pointer-events: none; position: absolute; }
</style>
