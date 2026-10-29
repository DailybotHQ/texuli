<script lang="ts">
import type { HTMLThAttributes } from 'svelte/elements';
import { cx } from '../../internal/cx.ts';
import { getTableContext, stackedRole } from './context.ts';
import { type TableAlign, tableCellClass } from './variants.ts';
import './table.css';

type Props = Omit<HTMLThAttributes, 'align'> & {
  /** The rendered root element (bindable). */
  ref?: HTMLElement | null;
  /** Text alignment; `end` for numbers. */
  align?: TableAlign;
  /** Tabular figures, aligned to the end. */
  numeric?: boolean;
};

let {
  align,
  numeric = false,
  scope = 'col',
  class: className,
  children,
  ref = $bindable(null),
  ...rest
}: Props = $props();

const context = getTableContext();
</script>

<th
  bind:this={ref}
  {scope}
  class={tableCellClass({
    align: align ?? (numeric ? 'end' : 'start'),
    class: cx(
      'tx-table__head',
      numeric && 'tx-table__cell--numeric',
      className
    ),
  })}
  role={stackedRole(context, scope === 'row' || scope === 'rowgroup' ? 'rowheader' : 'columnheader')}
  data-tx-table-head
  {...rest}
>
  {@render children?.()}
</th>
