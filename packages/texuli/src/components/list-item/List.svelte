<script lang="ts">
/**
 * List (ADR-032): a `<ul>` of ListItem rows. `divided` draws a token border
 * between items; spacing still scales with `--tx-density`.
 */
import type { HTMLAttributes } from 'svelte/elements';
import { type ClassValue, cx } from '../../internal/cx.ts';
import './list-item.css';

type Props = HTMLAttributes<HTMLUListElement> & {
  /** Draw a hairline between items. */
  divided?: boolean;
  class?: ClassValue;
  /** The rendered `ul` (bindable). */
  ref?: HTMLUListElement | null;
};

let {
  divided = false,
  class: className,
  ref = $bindable(null),
  children,
  ...rest
}: Props = $props();
</script>

<ul
  {...rest}
  bind:this={ref}
  class={cx('tx-list', divided && 'tx-list--divided', className)}
  role="list"
  data-tx-component="list"
>
  {@render children?.()}
</ul>
