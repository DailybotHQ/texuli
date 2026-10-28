<script lang="ts">
import type { HTMLAttributes } from 'svelte/elements';
import { cx } from '../../internal/cx.ts';
import { getTableContext, stackedRole } from './context.ts';
import './table.css';

type Props = HTMLAttributes<HTMLTableSectionElement> & {
  /** The rendered root element (bindable). */
  ref?: HTMLElement | null;
};

let { class: className, children, ref = $bindable(null), ...rest }: Props = $props();

const context = getTableContext();
</script>

<tfoot
  bind:this={ref}
  class={cx('tx-table__footer', className)}
  role={stackedRole(context, 'rowgroup')}
  data-tx-table-footer
  {...rest}
>
  {@render children?.()}
</tfoot>
