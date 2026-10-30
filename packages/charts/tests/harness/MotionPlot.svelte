<script lang="ts">
/** tests/interaction.test.ts (G98): an InteractivePlot below a texuli/motion MotionProvider. */
import { MotionProvider } from 'texuli/motion';
import InteractivePlot from '../../src/interaction/InteractivePlot.svelte';
import type { ChartFormatters, PlotSeries } from '../../src/interaction/model.ts';

let {
  reducedMotion,
  series,
  formatters,
}: {
  reducedMotion?: boolean;
  series: readonly PlotSeries[];
  formatters: ChartFormatters;
} = $props();
</script>

<MotionProvider {reducedMotion}>
  <InteractivePlot
    label="Motion plot"
    {series}
    width={480}
    height={220}
    plot={{ x: 40, y: 10, width: 400, height: 180 }}
    {formatters}
  />
</MotionProvider>
