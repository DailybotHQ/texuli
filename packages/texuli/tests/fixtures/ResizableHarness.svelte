<script lang="ts">
import type { SplitterStorage } from '@texuli/primitives/splitter';
import {
  ResizableHandle,
  type ResizableHandleSize,
  ResizablePanel,
  ResizablePanelGroup,
  type ResizableVariant,
} from '../../src/components/resizable/index.ts';

type Props = {
  direction?: 'horizontal' | 'vertical';
  variant?: ResizableVariant;
  size?: ResizableHandleSize;
  withGrip?: boolean;
  label?: string;
  disabled?: boolean;
  dir?: 'ltr' | 'rtl';
  layout?: number[];
  storage?: SplitterStorage;
  onLayoutChange?: (layout: number[]) => void;
  onCollapse?: () => void;
  /** Render the handle without a label, to see its default name. */
  defaultLabel?: boolean;
};

let {
  direction = 'horizontal',
  variant,
  size,
  withGrip,
  label = 'Resize navigation',
  disabled = false,
  dir,
  layout = $bindable(),
  storage,
  onLayoutChange,
  onCollapse,
  defaultLabel = false,
}: Props = $props();
</script>

<!-- happy-dom computes direction from the style, not the dir attribute. -->
<div {dir} style:direction={dir}>
  <ResizablePanelGroup
    {direction}
    {variant}
    {disabled}
    bind:layout
    {onLayoutChange}
    autoSaveId={storage ? 'harness' : undefined}
    {storage}
    class="consumer-group"
    data-testid="group"
  >
    <ResizablePanel id="nav-pane" defaultSize={30} minSize={20} maxSize={60} collapsible {onCollapse} class="consumer-panel">
      <p>Navigation</p>
    </ResizablePanel>
    {#if defaultLabel}
      <ResizableHandle {size} {withGrip} class="consumer-handle" />
    {:else}
      <ResizableHandle {label} {size} {withGrip} class="consumer-handle" />
    {/if}
    <ResizablePanel minSize={30}>
      <p>Messages</p>
    </ResizablePanel>
  </ResizablePanelGroup>
</div>
