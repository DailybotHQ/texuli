<script lang="ts">
import type { Snippet } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';
import { navigationMenuContext } from './context.ts';

type IndicatorProps = HTMLAttributes<HTMLDivElement> & { children?: Snippet };

let { children, ...rest }: IndicatorProps = $props();
const context = navigationMenuContext.get();
let box = $state({ offset: 0, size: 0 });

// Follow the open trigger along the list's axis.
$effect(() => {
  const open = context.value;
  const root = context.root;
  if (!open || !root) return;
  const trigger = root.ownerDocument.getElementById(context.triggerId(open));
  const list = trigger?.closest('ul');
  if (!trigger || !list) return;
  const t = trigger.getBoundingClientRect();
  const l = list.getBoundingClientRect();
  box =
    context.orientation === 'horizontal'
      ? { offset: t.left - l.left, size: t.width }
      : { offset: t.top - l.top, size: t.height };
});
</script>

<div
  aria-hidden="true"
  data-state={context.value ? 'visible' : 'hidden'}
  data-orientation={context.orientation}
  style:--tx-navigation-menu-indicator-offset={`${box.offset}px`}
  style:--tx-navigation-menu-indicator-size={`${box.size}px`}
  {...rest}
>
  {@render children?.()}
</div>
