<script lang="ts">
import type { HTMLAttributes } from 'svelte/elements';
import { registerBackdrop } from '../internal/backdrop.ts';
import type { RefProp } from '../internal/ref.ts';
import { getAlertDialogContext } from './context.ts';

type Props = Omit<HTMLAttributes<HTMLDivElement>, 'children'> & {
  children?: import('svelte').Snippet;
} & RefProp;

let { children, ref = $bindable(null), ...rest }: Props = $props();
const context = getAlertDialogContext();
let isOpen = $state(context.open);

$effect(() => context.subscribeOpen((next) => (isOpen = next)));

function register(node: HTMLDivElement): () => void {
  // Re-registers if the mode or the container changes.
  return registerBackdrop(node, {
    contained: context.mode === 'contained',
    container: context.container,
    label: 'alert-dialog-backdrop',
    subscribeOpen: (listener) => context.subscribeOpen(listener),
  });
}
</script>

<!-- Alert dialogs never dismiss on backdrop pointer; Escape and Cancel/Action close. -->
<div bind:this={ref}
  {...rest}
  aria-hidden="true"
  data-state={isOpen ? 'open' : 'closed'}
  hidden={!isOpen}
  {@attach register}
>
  {#if isOpen}{@render children?.()}{/if}
</div>

<style>
div {
  position: fixed;
  inset: 0;
  width: 100vw;
  height: 100vh;
  margin: 0;
  padding: 0;
  border: 0;
}
/* Contained: fill the container (its containing block), not the viewport. */
div[data-contained] {
  position: absolute;
  width: auto;
  height: auto;
}
</style>
