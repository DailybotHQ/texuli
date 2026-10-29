<script lang="ts">
import type { HTMLAttributes } from 'svelte/elements';
import type { RefProp } from '../internal/ref.ts';
import { stateAttributes } from '../internal/state.ts';
import { switchContext } from './context.ts';

type Props = HTMLAttributes<HTMLSpanElement> & {
  class?: string;
} & RefProp;

let { class: className, ref = $bindable(null), ...rest }: Props = $props();

const ctx = switchContext.get();
const dataState = $derived(ctx.checked ? 'checked' : 'unchecked');
</script>

<span bind:this={ref}
  {...rest}
  class={typeof className === 'string' ? className : undefined}
  data-tx-switch-thumb
  {...stateAttributes(dataState === 'checked' ? 'checked' : 'unchecked', ctx.disabled)}
  aria-hidden="true"
></span>
