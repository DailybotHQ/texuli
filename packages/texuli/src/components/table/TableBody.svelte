<script lang="ts">
import type { HTMLAttributes } from 'svelte/elements';
import { cx } from '../../internal/cx.ts';
import { getTableContext, stackedRole } from './context.ts';
import './table.css';

type Props = HTMLAttributes<HTMLTableSectionElement>;

let { class: className, children, ...rest }: Props = $props();

const context = getTableContext();
</script>

<tbody
  class={cx('tx-table__body', className)}
  role={stackedRole(context, 'rowgroup')}
  data-tx-table-body
  {...rest}
>
  {@render children?.()}
</tbody>
