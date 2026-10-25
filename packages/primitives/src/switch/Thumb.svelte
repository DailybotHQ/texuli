<script lang="ts">
import type { HTMLAttributes } from 'svelte/elements';
import { stateAttributes } from '../internal/state.ts';
import { switchContext } from './context.ts';

type Props = HTMLAttributes<HTMLSpanElement> & {
  class?: string;
};

let { class: className, ...rest }: Props = $props();

const ctx = switchContext.get();
const dataState = $derived(ctx.checked ? 'checked' : 'unchecked');
</script>

<span
  {...rest}
  class={typeof className === 'string' ? className : undefined}
  data-tx-switch-thumb
  {...stateAttributes(dataState === 'checked' ? 'checked' : 'unchecked', ctx.disabled)}
  aria-hidden="true"
></span>
