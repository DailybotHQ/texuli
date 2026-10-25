<script lang="ts">
import type { HTMLAttributes } from 'svelte/elements';
import { type ClassValue } from '../../internal/cx.ts';
import { selectGroupClass } from './variants.ts';

type Props = HTMLAttributes<HTMLDivElement> & {
  children?: import('svelte').Snippet;
  class?: ClassValue;
};

let { children, class: className, ...rest }: Props = $props();
</script>

<div
  class={selectGroupClass({ class: className })}
  data-tx-select-group
  role="group"
  {...rest}
>
  {@render children?.()}
</div>
