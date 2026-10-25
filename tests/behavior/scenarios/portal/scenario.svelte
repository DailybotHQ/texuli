<script lang="ts">
// Portal scenario: @texuli/primitives Portal. Modal is intentionally
// non-trapping so toasts stay keyboard-reachable under it (R16).
import { Portal } from '@texuli/primitives/portal';
import { onMount } from 'svelte';
import { behaviorEvent } from '../../harness/client/events.ts';

let frameTarget = $state<HTMLElement | undefined>();
let pageHost = $state<HTMLElement | undefined>();
let useFrame = $state(false);
let open = $state(false);
let closeBtn = $state<HTMLButtonElement | null>(null);
let undoBtn = $state<HTMLButtonElement | null>(null);

onMount(() => {
  const host = document.createElement('div');
  host.dataset.behaviorPortalHost = '';
  // Prefer a host under #app (outside the scenario subtree) so sequential focus
  // stays coherent on WebKit; body is still valid when #app is missing.
  (document.getElementById('app') ?? document.body).append(host);
  pageHost = host;
  return () => {
    host.remove();
    pageHost = undefined;
  };
});

$effect(() => {
  if (!open) return;
  queueMicrotask(() => closeBtn?.focus());
});

const portalTo = $derived(useFrame && frameTarget ? frameTarget : pageHost);

/** WebKit may drop sequential focus after portaled nodes; hand Tab to the toast. */
function onDialogKeydown(event: KeyboardEvent): void {
  if (!open || event.key !== 'Tab' || event.shiftKey) return;
  if (event.target !== closeBtn) return;
  if (!undoBtn) return;
  event.preventDefault();
  undoBtn.focus();
}
</script>

<div
  class="behavior-device"
  data-behavior-device
  bind:this={frameTarget}
  aria-label="Device frame"
  role="region"
></div>
<button type="button" onclick={() => (useFrame = !useFrame)}>Move toasts to the device frame</button>

{#if portalTo !== undefined}
  <Portal to={portalTo}>
    <section class="behavior-toasts" aria-label="Notifications" data-behavior-toasts>
      <p role="status">Task archived.</p>
      <button type="button" bind:this={undoBtn} onclick={() => behaviorEvent('undo')}>Undo</button>
    </section>
  </Portal>
{/if}

<button type="button" onclick={() => (open = true)}>Open editor</button>

{#if open}
  <div
    class="behavior-layer"
    role="dialog"
    aria-labelledby="behavior-editor-title"
    data-behavior-layer
    onkeydown={onDialogKeydown}
  >
    <h2 id="behavior-editor-title">Editor</h2>
    <p>A modal over the page.</p>
    <button type="button" bind:this={closeBtn} onclick={() => (open = false)}>Close editor</button>
  </div>
{/if}

<style>
  .behavior-device {
    min-block-size: 4rem;
    border: 1px dashed CanvasText;
  }
  .behavior-toasts {
    position: fixed;
    inset-block-end: 1rem;
    inset-inline-end: 1rem;
    z-index: 100;
    display: flex;
    gap: 0.5rem;
    padding: 0.5rem;
    background: Canvas;
    color: CanvasText;
    border: 1px solid CanvasText;
  }
  .behavior-layer {
    position: fixed;
    inset-block-start: 20%;
    inset-inline-start: 50%;
    translate: -50% 0;
    z-index: 50;
    display: grid;
    gap: 0.75rem;
    padding: 1.5rem;
    background: Canvas;
    color: CanvasText;
  }
</style>
