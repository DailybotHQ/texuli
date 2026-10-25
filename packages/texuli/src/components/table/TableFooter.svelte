<script lang="ts">
import type { HTMLAttributes } from 'svelte/elements';
import { cx } from '../../internal/cx.ts';
import { getTableContext, stackedRole } from './context.ts';
import './table.css';

type Props = HTMLAttributes<HTMLTableSectionElement>;

let { class: className, children, ...rest }: Props = $props();

const context = getTableContext();
</script>

<tfoot
  class={cx('tx-table__footer', className)}
  role={stackedRole(context, 'rowgroup')}
  data-tx-table-footer
  {...rest}
>
  {@render children?.()}
</tfoot>
