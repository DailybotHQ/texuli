<script lang="ts">
import { untrack } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';
import { registerBackdrop } from '../internal/backdrop.ts';
import { createBackdropPresence, type OverlayMotionHooks } from '../internal/motion-hold.ts';
import type { RefProp } from '../internal/ref.ts';
import { getAlertDialogContext } from './context.ts';

type Props = Omit<HTMLAttributes<HTMLDivElement>, 'children'> & {
  children?: import('svelte').Snippet;
  /** Enter and exit motion (texuli passes `texuli/motion` hooks); it stays shown while the exit plays. */
  motionHooks?: OverlayMotionHooks;
} & RefProp;

let { children, motionHooks, ref = $bindable(null), ...rest }: Props = $props();
const context = getAlertDialogContext();
let isOpen = $state(context.open);
let held = $state(false);
let node: HTMLDivElement | null = null;
const presence = createBackdropPresence({
  open: untrack(() => context.open),
  hooks: () => motionHooks,
  onChange: (open, exiting) => {
    isOpen = open;
    held = exiting;
  },
});

$effect(() => context.subscribeOpen((next) => presence.setOpen(next, node)));
$effect(() => () => presence.dispose());

function register(element: HTMLDivElement): () => void {
  node = element;
  // Re-registers if the mode or the container changes.
  const release = registerBackdrop(element, {
    contained: context.mode === 'contained',
    container: context.container,
    label: 'alert-dialog-backdrop',
    subscribeOpen: (listener) => presence.subscribeVisible(listener),
  });
  return () => {
    release();
    if (node === element) node = null;
  };
}
</script>

<!-- Alert dialogs never dismiss on backdrop pointer; Escape and Cancel/Action close. -->
<div bind:this={ref}
  {...rest}
  aria-hidden="true"
  data-state={isOpen ? 'open' : 'closed'}
  hidden={!isOpen && !held}
  inert={(!isOpen && held) || undefined}
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
/* An exiting backdrop never takes a press meant for the page. */
div[inert] {
  pointer-events: none;
}
</style>
