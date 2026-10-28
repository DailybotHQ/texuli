<script lang="ts">
import type { HTMLTdAttributes } from 'svelte/elements';
import { cx } from '../../internal/cx.ts';
import { getTableContext, stackedRole } from './context.ts';
import './table.css';

type Props = HTMLTdAttributes & {
  /** The message cell, the `<td>` (bindable). */
  ref?: HTMLElement | null;
  /** How many columns the message spans (the table's column count). */
  colspan: number;
};

let { colspan, class: className, children, ref = $bindable(null), ...rest }: Props = $props();

const context = getTableContext();
</script>

<tr class="tx-table__row tx-table__row--empty" role={stackedRole(context, 'row')} data-tx-table-empty>
  <td
    bind:this={ref}
    colspan={Math.max(1, Math.floor(colspan))}
    class={cx('tx-table__cell tx-table__empty', className)}
    role={stackedRole(context, 'cell')}
    {...rest}
  >
    {@render children?.()}
  </td>
</tr>
