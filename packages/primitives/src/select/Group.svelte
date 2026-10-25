<script lang="ts">
import type { HTMLAttributes } from 'svelte/elements';
import { getSelectContext } from './context.ts';
import { setSelectGroupContext } from './group-context.ts';

type Props = Omit<HTMLAttributes<HTMLElement>, 'children'> & {
  children?: import('svelte').Snippet;
};

let { children, class: className, ...rest }: Props = $props();

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

<div
  role="group"
  aria-labelledby={labelId}
  data-tx-select-group=""
  class={className}
  {...rest}
>
  {@render children?.()}
</div>
