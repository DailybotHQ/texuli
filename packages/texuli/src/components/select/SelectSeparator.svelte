<script lang="ts">
import type { HTMLAttributes } from 'svelte/elements';
import { type ClassValue } from '../../internal/cx.ts';
import { selectSeparatorClass } from './variants.ts';

type Props = HTMLAttributes<HTMLDivElement> & {
  /** The rendered root element (bindable). */
  ref?: HTMLElement | null;
  class?: ClassValue;
};

let { class: className, ref = $bindable(null), ...rest }: Props = $props();
</script>

<!--
  Decorative: a listbox may contain only options and groups, so the rule is
  hidden from assistive tech instead of being an <hr> (role separator).
-->
<div
  bind:this={ref}
  class={selectSeparatorClass({ class: className })}
  data-tx-select-separator
  aria-hidden="true"
  {...rest}
></div>
