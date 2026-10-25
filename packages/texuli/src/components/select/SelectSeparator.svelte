<script lang="ts">
import type { HTMLAttributes } from 'svelte/elements';
import { type ClassValue } from '../../internal/cx.ts';
import { selectSeparatorClass } from './variants.ts';

type Props = HTMLAttributes<HTMLDivElement> & {
  class?: ClassValue;
};

let { class: className, ...rest }: Props = $props();
</script>

<!--
  Decorative: a listbox may contain only options and groups, so the rule is
  hidden from assistive tech instead of being an <hr> (role separator).
-->
<div
  class={selectSeparatorClass({ class: className })}
  data-tx-select-separator
  aria-hidden="true"
  {...rest}
></div>
