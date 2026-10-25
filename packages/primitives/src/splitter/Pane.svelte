<script lang="ts">
import type { Snippet } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';
import { splitterContext } from './context.ts';
import { isCollapsed, type PaneConstraints } from './model.ts';

type Props = Omit<HTMLAttributes<HTMLDivElement>, 'children'> &
  PaneConstraints & {
    /** Called when the pane collapses or opens again. */
    onCollapse?: () => void;
    onExpand?: () => void;
    ref?: HTMLElement | null;
    children?: Snippet;
  };

let {
  defaultSize,
  minSize,
  maxSize,
  collapsible,
  collapsedSize,
  onCollapse,
  onExpand,
  id,
  ref = $bindable(null),
  children,
  ...rest
}: Props = $props();

const context = splitterContext.get();
const generatedId = $props.id();
const paneId = $derived(id ?? `${generatedId}-pane`);

const entry = $state({
  id: '',
  node: null as HTMLElement | null,
  constraints: {} as PaneConstraints,
});
$effect.pre(() => {
  entry.id = paneId;
  entry.constraints = { defaultSize, minSize, maxSize, collapsible, collapsedSize };
});
$effect(() => {
  entry.node = ref;
  return context.registerPane(entry);
});

const index = $derived(context.panes.indexOf(entry));
const size = $derived(index >= 0 ? context.layout[index] : undefined);
const collapsed = $derived(size !== undefined && isCollapsed(size, entry.constraints));

let wasCollapsed: boolean | undefined;
$effect(() => {
  const now = collapsed;
  if (wasCollapsed !== undefined && now !== wasCollapsed) (now ? onCollapse : onExpand)?.();
  wasCollapsed = now;
});
</script>

<div
  bind:this={ref}
  {...rest}
  id={paneId}
  data-splitter-pane
  data-state={collapsed ? 'collapsed' : 'expanded'}
  inert={collapsed && size === 0 ? true : undefined}
  style:flex-grow={size ?? 1}
  style:flex-shrink="1"
  style:flex-basis="0"
  style:overflow="hidden"
>
  {@render children?.()}
</div>
