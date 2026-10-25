<script lang="ts">
import { Splitter, type SplitterDirection, type SplitterStorage } from '../src/splitter/index.ts';

/** A two-pane group (navigation | content) for the unit tests. */
let {
  direction = 'horizontal',
  storage,
  autoSaveId,
  layout = $bindable(),
  onLayoutChange,
  onCollapse,
  onExpand,
  dir,
  useChild = false,
}: {
  direction?: SplitterDirection;
  storage?: SplitterStorage;
  autoSaveId?: string;
  layout?: number[];
  onLayoutChange?: (layout: number[]) => void;
  onCollapse?: () => void;
  onExpand?: () => void;
  dir?: 'ltr' | 'rtl';
  useChild?: boolean;
} = $props();
</script>

<!-- happy-dom computes direction from the style, not the dir attribute. -->
<div {dir} style:direction={dir}>
  <Splitter.Root {direction} {storage} {autoSaveId} bind:layout {onLayoutChange} data-testid="group">
    <Splitter.Pane id="nav" defaultSize={30} minSize={20} maxSize={60} collapsible {onCollapse} {onExpand}>
      <a href="#inbox">Inbox</a>
    </Splitter.Pane>
    {#if useChild}
      <Splitter.Handle label="Resize navigation">
        {#snippet child({ props })}<button type="button" data-testid="custom-handle" {...props}></button>{/snippet}
      </Splitter.Handle>
    {:else}
      <Splitter.Handle label="Resize navigation" />
    {/if}
    <Splitter.Pane id="main" minSize={30}>
      <p>Main content</p>
    </Splitter.Pane>
  </Splitter.Root>
</div>
