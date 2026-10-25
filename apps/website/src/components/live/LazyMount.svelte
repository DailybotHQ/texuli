<script lang="ts">
/**
 * Mount children only after the host intersects the viewport (or immediately
 * when eager / IntersectionObserver unavailable).
 */
import type { Snippet } from 'svelte';

type Props = {
  children: Snippet;
  rootMargin?: string;
  eager?: boolean;
  /** Called once when the mount becomes visible (load stage/panel chunks). */
  onVisible?: () => void;
};

let { children, rootMargin = '160px 0px', eager = false, onVisible }: Props = $props();

let host = $state<HTMLDivElement | undefined>();
let visible = $state(eager);
let fired = $state(false);

function fire(): void {
  if (fired) return;
  fired = true;
  onVisible?.();
}

$effect(() => {
  if (eager) {
    visible = true;
    fire();
    return;
  }
  const node = host;
  if (!node) return;
  const IO = globalThis.IntersectionObserver;
  if (typeof IO !== 'function') {
    visible = true;
    fire();
    return;
  }
  const observer = new IO(
    (entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        visible = true;
        fire();
        observer.disconnect();
      }
    },
    { root: null, rootMargin, threshold: 0.01 }
  );
  observer.observe(node);
  return () => observer.disconnect();
});
</script>

<div bind:this={host} class="lazy" data-tx-lazy-mount data-visible={visible ? 'true' : 'false'}>
  {#if visible}
    {@render children()}
  {:else}
    <div class="lazy__slot" aria-hidden="true"></div>
  {/if}
</div>

<style>
  .lazy {
    min-block-size: 2.5rem;
  }
  .lazy__slot {
    min-block-size: 8rem;
    border-radius: var(--tx-radius, 0.5rem);
    border: 1px dashed var(--tx-border, ButtonBorder);
    background: var(--tx-muted, Canvas);
  }
</style>
