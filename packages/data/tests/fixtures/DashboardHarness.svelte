<script lang="ts">
import { type MotionLevel, MotionProvider } from 'texuli/motion';
import { Dashboard, type DashboardLayout, DashboardWidget } from '../../src/dashboard/index.ts';

interface Widget {
  id: string;
  title: string;
  x?: number;
  y?: number;
  w?: number;
  h?: number;
  locked?: boolean;
}

let {
  widgets,
  layout = $bindable(),
  layouts = $bindable(),
  editable = true,
  breakpoint,
  dir,
  level = 'full',
  reducedMotion,
  onLayoutChange,
}: {
  widgets: Widget[];
  layout?: DashboardLayout;
  layouts?: Record<string, DashboardLayout>;
  editable?: boolean;
  breakpoint?: string;
  dir?: 'ltr' | 'rtl';
  level?: MotionLevel;
  reducedMotion?: boolean;
  onLayoutChange?: (
    layout: DashboardLayout,
    detail: { breakpoint: string; widget: string }
  ) => void;
} = $props();
</script>

<MotionProvider {level} {reducedMotion}>
  <Dashboard label="Operations" bind:layout bind:layouts {editable} {breakpoint} {dir} {onLayoutChange}>
    {#each widgets as widget (widget.id)}
      <DashboardWidget
        id={widget.id}
        title={widget.title}
        x={widget.x}
        y={widget.y}
        w={widget.w}
        h={widget.h}
        locked={widget.locked}
      >
        <p data-content={widget.id}>{widget.title} body</p>
      </DashboardWidget>
    {/each}
  </Dashboard>
</MotionProvider>
<output data-bound-layout>{JSON.stringify(layout ?? [])}</output>
