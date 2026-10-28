<script lang="ts">
import type { HTMLAttributes } from 'svelte/elements';
import { cx } from '../../internal/cx.ts';
import { getTableContext } from './context.ts';
import './table.css';

type Props = HTMLAttributes<HTMLElement> & {
  /** The rendered root element (bindable). */
  ref?: HTMLElement | null;
  /** Keep the caption for assistive technology only (it still names the table). */
  hidden?: boolean;
};

let {
  hidden = false,
  id,
  class: className,
  children,
  ref = $bindable(null),
  ...rest
}: Props = $props();

const uid = $props.id();
const captionId = $derived(id ?? `tx-table-caption-${uid}`);
const context = getTableContext();

$effect(() => {
  context?.setCaptionId(captionId);
  return () => context?.setCaptionId(undefined);
});
</script>

<caption
  bind:this={ref}
  id={captionId}
  class={cx(
    'tx-table__caption',
    hidden && 'tx-table__sr-only',
    className
  )}
  data-tx-table-caption
  {...rest}
>
  {@render children?.()}
</caption>
