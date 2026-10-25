<script lang="ts">
// Avatar scenario: @texuli/primitives Avatar public API only.
import { Avatar } from '../../../../packages/primitives/src/avatar/index.ts';

const PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

let status = $state<'loading' | 'loaded' | 'error'>('loading');
/** `null` = no image part yet (stay loading with fallback). */
let src = $state<string | null>(null);
let imgEl = $state<HTMLImageElement | null>(null);

function beginLoad() {
  status = 'loading';
  src = PNG;
}

function simulateLoad() {
  if (!src) beginLoad();
  // Wait a tick for the img to mount, then fire load if the browser has not.
  queueMicrotask(() => {
    const node =
      imgEl ?? document.querySelector<HTMLImageElement>('[data-behavior-avatar="image"]');
    if (node && status !== 'loaded') node.dispatchEvent(new Event('load'));
  });
}

function simulateError() {
  // Drop the image and force the error status so the row is stable across browsers
  // (data URIs often auto-succeed before a synthetic error event runs).
  src = null;
  status = 'error';
}
</script>

<div class="behavior-avatar">
  <Avatar.Root
    delayMs={0}
    bind:loadingStatus={status}
    data-behavior-avatar="root"
    class="behavior-avatar-root"
  >
    {#if src}
      <Avatar.Image
        bind:ref={imgEl}
        {src}
        srcTrust="developer"
        alt="Ada Example"
        data-behavior-avatar="image"
        class="behavior-avatar-image"
      />
    {/if}
    <Avatar.Fallback data-behavior-avatar="fallback" class="behavior-avatar-fallback">AE</Avatar.Fallback>
  </Avatar.Root>
  <p data-behavior-status>{status}</p>
  <button type="button" onclick={beginLoad}>Begin load</button>
  <button type="button" onclick={simulateLoad}>Simulate load</button>
  <button type="button" onclick={simulateError}>Simulate error</button>
</div>

<style>
  :global(.behavior-avatar-root) {
    display: inline-flex;
    inline-size: 2.5rem;
    block-size: 2.5rem;
    align-items: center;
    justify-content: center;
    border-radius: 9999px;
    background: color-mix(in srgb, CanvasText 12%, Canvas);
    overflow: hidden;
  }
  :global(.behavior-avatar-image) {
    inline-size: 100%;
    block-size: 100%;
    object-fit: cover;
  }
  :global(.behavior-avatar-fallback) {
    font-size: 0.75rem;
    font-weight: 600;
  }
</style>
