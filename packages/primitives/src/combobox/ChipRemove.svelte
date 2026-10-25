<script lang="ts">
import type { Snippet } from 'svelte';
import type { HTMLButtonAttributes } from 'svelte/elements';
import { getComboboxContext } from './context.ts';

type Props = Omit<HTMLButtonAttributes, 'children'> & { value: string; children?: Snippet };
let { value, children, onclick, ...rest }: Props = $props();
type ClickEvent = Parameters<NonNullable<HTMLButtonAttributes['onclick']>>[0];
const context = getComboboxContext();
function remove(event: ClickEvent): void {
  onclick?.(event);
  if (!event.defaultPrevented) context.remove(value);
}
</script>

<button {...rest} type="button" aria-label={rest['aria-label'] ?? `Remove ${context.labelFor(value)}`} disabled={context.disabled} onclick={remove}>
  {#if children}
    {@render children()}
  {:else}
    Remove
  {/if}
</button>
