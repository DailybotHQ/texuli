<script lang="ts">
import type { HTMLAttributes } from 'svelte/elements';
import { registerBackdrop } from '../internal/backdrop.ts';
import { getDialogContext } from './context.ts';

type PointerDownEvent = Parameters<NonNullable<HTMLAttributes<HTMLDivElement>['onpointerdown']>>[0];
type Props = Omit<HTMLAttributes<HTMLDivElement>, 'children'> & {
  children?: import('svelte').Snippet;
};

let { children, onpointerdown, ...rest }: Props = $props();
const context = getDialogContext();
let isOpen = $state(context.open);

$effect(() => context.subscribeOpen((next) => (isOpen = next)));

function register(node: HTMLDivElement): () => void {
  // Re-registers if the mode or the container changes.
  return registerBackdrop(node, {
    contained: context.mode === 'contained',
    container: context.container,
    label: 'dialog-backdrop',
    subscribeOpen: (listener) => context.subscribeOpen(listener),
  });
}

function handlePointerDown(event: PointerDownEvent): void {
  onpointerdown?.(event);
  if (!event.defaultPrevented && event.target === event.currentTarget)
    context.setOpen(false, event);
}
</script>

<div
  {...rest}
  aria-hidden="true"
  data-state={isOpen ? 'open' : 'closed'}
  hidden={!isOpen}
  onpointerdown={handlePointerDown}
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
