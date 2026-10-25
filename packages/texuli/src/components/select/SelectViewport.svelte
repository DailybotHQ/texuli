<script lang="ts">
import { Viewport as PrimitiveViewport } from '@texuli/primitives/select';
import type { ComponentProps, Snippet } from 'svelte';
import { type ClassValue, cx } from '../../internal/cx.ts';

type Props = ComponentProps<typeof PrimitiveViewport> & {
  children?: Snippet;
  class?: ClassValue;
};

let { children, class: className, ...rest }: Props = $props();
</script>

<PrimitiveViewport
  class={cx('tx-select-viewport', className)}
  data-tx-select-viewport
  {...rest}
>
  {@render children?.()}
</PrimitiveViewport>
