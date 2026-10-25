<script lang="ts">
import { Pagination as Primitive } from '@texuli/primitives/pagination';
import { type ClassValue } from '../../internal/cx.ts';
import { paginationEllipsisClass } from './variants.ts';

type Props = {
  class?: ClassValue;
};

let { class: className }: Props = $props();
</script>

<span data-tx-pagination-ellipsis>
  <Primitive.Ellipsis
    class={paginationEllipsisClass({
      class: className,
    })}
  />
</span>
