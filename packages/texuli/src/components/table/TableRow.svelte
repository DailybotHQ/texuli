<script lang="ts">
import type { HTMLAttributes } from 'svelte/elements';
import { cx } from '../../internal/cx.ts';
import { getTableContext, stackedRole } from './context.ts';
import './table.css';

type Props = HTMLAttributes<HTMLTableRowElement> & {
  /**
   * Highlights the row (accent fill and an edge mark). It is visual only: a
   * static table has no selection semantics, so pair it with a checked
   * checkbox or text in the row that says so.
   */
  selected?: boolean;
};

let { selected = false, class: className, children, ...rest }: Props = $props();

const context = getTableContext();
</script>

<tr
  class={cx('tx-table__row', className)}
  role={stackedRole(context, 'row')}
  data-state={selected ? 'selected' : undefined}
  data-tx-table-row
  {...rest}
>
  {@render children?.()}
</tr>
