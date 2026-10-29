<script lang="ts">
import { Pagination as Primitive } from '@texuli/primitives/pagination';
import type { HTMLAttributes } from 'svelte/elements';
import { type ClassValue } from '../../internal/cx.ts';
import type { RefProp } from '../../internal/ref.ts';
import { paginationEllipsisClass } from './variants.ts';

/**
 * The visual gap between page runs (hidden from assistive tech). Extra
 * attributes and handlers land on the wrapper; the class on the mark.
 */
type Props = Omit<HTMLAttributes<HTMLSpanElement>, 'children' | 'class'> & {
  class?: ClassValue;
};

let { class: className, ref = $bindable(null), ...rest }: Props & RefProp = $props();
</script>

<span bind:this={ref} {...rest} data-tx-pagination-ellipsis>
  <Primitive.Ellipsis
    class={paginationEllipsisClass({
      class: className,
    })}
  />
</span>
