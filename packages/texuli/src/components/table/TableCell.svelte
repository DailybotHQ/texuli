<script lang="ts">
import type { HTMLTdAttributes } from 'svelte/elements';
import { cx } from '../../internal/cx.ts';
import { getTableContext, stackedRole } from './context.ts';
import { type TableAlign, tableCellClass } from './variants.ts';
import './table.css';

type Props = Omit<HTMLTdAttributes, 'align'> & {
  /** The rendered root element (bindable). */
  ref?: HTMLElement | null;
  /** Text alignment; `end` for numbers. */
  align?: TableAlign;
  /** Tabular figures, aligned to the end. */
  numeric?: boolean;
  /**
   * The label a stacked row shows before this value. By default the table
   * copies the column header; set it to override (pass translated text).
   */
  label?: string;
};

let {
  align,
  numeric = false,
  label,
  class: className,
  children,
  ref = $bindable(null),
  ...rest
}: Props = $props();

const context = getTableContext();
</script>

<td
  bind:this={ref}
  class={tableCellClass({
    align: align ?? (numeric ? 'end' : 'start'),
    class: cx(
      'tx-table__cell',
      numeric && 'tx-table__cell--numeric',
      className
    ),
  })}
  role={stackedRole(context, 'cell')}
  data-label={label}
  data-tx-label-fixed={label === undefined ? undefined : ''}
  data-tx-table-cell
  {...rest}
>
  {@render children?.()}
</td>
