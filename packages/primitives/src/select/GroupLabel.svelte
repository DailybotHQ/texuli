<script lang="ts">
import type { HTMLAttributes } from 'svelte/elements';
import { getSelectGroupContext } from './group-context.ts';

type Props = Omit<HTMLAttributes<HTMLElement>, 'children'> & {
  children?: import('svelte').Snippet;
};

let { children, class: className, id, ...rest }: Props = $props();

const group = getSelectGroupContext();
if (!group) {
  throw new Error('Select.GroupLabel must be rendered inside Select.Group');
}

const uid = $props.id();
// svelte-ignore state_referenced_locally
const resolvedId = id ?? `${uid}-heading`;
group.setLabelId(resolvedId);
</script>

<div id={resolvedId} data-tx-select-group-label="" class={className} {...rest}>
  {@render children?.()}
</div>
