<script lang="ts">
import type { HTMLAttributes } from 'svelte/elements';
import type { RefProp } from '../internal/ref.ts';
import { getSelectGroupContext } from './group-context.ts';

type Props = Omit<HTMLAttributes<HTMLElement>, 'children'> & {
  children?: import('svelte').Snippet;
} & RefProp;

let { children, class: className, id, ref = $bindable(null), ...rest }: Props = $props();

const group = getSelectGroupContext();
if (!group) {
  throw new Error('Select.GroupLabel must be rendered inside Select.Group');
}

const uid = $props.id();
// svelte-ignore state_referenced_locally
const resolvedId = id ?? `${uid}-heading`;
group.setLabelId(resolvedId);
</script>

<div bind:this={ref} id={resolvedId} data-tx-select-group-label="" class={className} {...rest}>
  {@render children?.()}
</div>
