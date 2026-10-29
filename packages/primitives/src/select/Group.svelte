<script lang="ts">
import type { HTMLAttributes } from 'svelte/elements';
import type { RefProp } from '../internal/ref.ts';
import { getSelectContext } from './context.ts';
import { setSelectGroupContext } from './group-context.ts';

type Props = Omit<HTMLAttributes<HTMLElement>, 'children'> & {
  children?: import('svelte').Snippet;
} & RefProp;

let { children, class: className, ref = $bindable(null), ...rest }: Props = $props();

// Ensure we are under Select.Root (throws if not).
getSelectContext();

const uid = $props.id();
let labelId = $state(`${uid}-label`);

setSelectGroupContext({
  get labelId() {
    return labelId;
  },
  setLabelId(id) {
    labelId = id;
  },
});
</script>

<div bind:this={ref}
  role="group"
  aria-labelledby={labelId}
  data-tx-select-group=""
  class={className}
  {...rest}
>
  {@render children?.()}
</div>
