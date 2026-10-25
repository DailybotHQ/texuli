<script lang="ts">
import type { HTMLAttributes } from 'svelte/elements';
import { type ClassValue } from '../../internal/cx.ts';
import { selectLabelClass } from './variants.ts';

type Props = HTMLAttributes<HTMLDivElement> & {
  children?: import('svelte').Snippet;
  class?: ClassValue;
};

let { children, class: className, ...rest }: Props = $props();
</script>

<div
  class={selectLabelClass({ class: className })}
  data-tx-select-label
  {...rest}
>
  {@render children?.()}
</div>
