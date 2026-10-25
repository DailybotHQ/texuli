<!-- Used only by isolated previews: carry the styles with the component, so
     pages without a preview do not link them. -->
<svelte:options css="injected" />

<script lang="ts">
/**
 * A live stage in an isolated preview document (an iframe on the same
 * origin). It loads when it nears the viewport, with its final height from
 * the start (no layout shift). Props, mode and direction travel by
 * `postMessage`, so the demo updates in place without reloading.
 */
import { untrack } from 'svelte';
import {
  PREVIEW_MAX_HEIGHT,
  PREVIEW_READY,
  PREVIEW_SIZE,
  PREVIEW_STATE,
  type PreviewDir,
  type PreviewMode,
  previewUrl,
  sanitizePreviewValues,
} from './preview.ts';

type Props = {
  componentId: string;
  /** Accessible name of the frame. */
  title: string;
  values: Readonly<Record<string, unknown>>;
  mode: PreviewMode;
  dir: PreviewDir;
  height?: 'sm' | 'md' | 'lg' | 'xl';
  /**
   * False for full-page layouts: the frame renders live but stays inert and
   * hidden from assistive tech, so a page of previews does not add every
   * layout's landmarks; the layout is operated in its own document.
   */
  interactive?: boolean;
};

let { componentId, title, values, mode, dir, height = 'md', interactive = true }: Props = $props();

let slot = $state<HTMLDivElement | undefined>();
let frame = $state<HTMLIFrameElement | undefined>();
let ready = $state(false);
/** Content height the preview reported; the frame never shrinks below its class height. */
let contentHeight = $state(0);
const BASE_HEIGHT = { sm: 200, md: 280, lg: 360, xl: 460 } as const;
const blockSize = $derived(
  contentHeight > BASE_HEIGHT[height]
    ? `${Math.min(PREVIEW_MAX_HEIGHT, Math.ceil(contentHeight))}px`
    : undefined
);
/**
 * True while focus is inside the preview. CSS cannot see focus in another
 * document, so the slot draws the focus ring from this.
 */
let focused = $state(false);
$effect(() => {
  const update = () => {
    focused = frame !== undefined && document.activeElement === frame;
  };
  // Focus entering the iframe blurs this window; leaving it fires focusin here.
  const onBlur = () => setTimeout(update);
  window.addEventListener('blur', onBlur);
  document.addEventListener('focusin', update);
  return () => {
    window.removeEventListener('blur', onBlur);
    document.removeEventListener('focusin', update);
  };
});

/** Set once the frame nears the viewport: the preview loads lazily. */
let src = $state<string | undefined>();

$effect(() => {
  const node = slot;
  if (!node || src) return;
  const load = () => {
    // The first URL carries mode and direction; later changes go by message.
    src = untrack(() => previewUrl(componentId, mode, dir));
  };
  const IO = globalThis.IntersectionObserver;
  if (typeof IO !== 'function') {
    load();
    return;
  }
  const observer = new IO(
    (entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        observer.disconnect();
        load();
      }
    },
    { rootMargin: '200px 0px' }
  );
  observer.observe(node);
  return () => observer.disconnect();
});

function send(): void {
  const target = frame?.contentWindow;
  if (!target || !ready) return;
  target.postMessage(
    {
      type: PREVIEW_STATE,
      id: componentId,
      state: { values: sanitizePreviewValues(values), mode, dir },
    },
    location.origin
  );
}

$effect(() => {
  function onMessage(event: MessageEvent): void {
    if (event.origin !== location.origin || event.source !== frame?.contentWindow) return;
    const data = event.data as { type?: unknown; id?: unknown } | null;
    if (data?.id !== componentId) return;
    if (data.type === PREVIEW_READY) {
      ready = true;
      send();
    } else if (data.type === PREVIEW_SIZE) {
      const reported = (data as { height?: unknown }).height;
      if (typeof reported === 'number' && Number.isFinite(reported)) contentHeight = reported;
    }
  }
  window.addEventListener('message', onMessage);
  return () => window.removeEventListener('message', onMessage);
});

$effect(() => {
  // Track every input, then post the new state.
  void [values, mode, dir, ready];
  send();
});
</script>

<!-- The slot holds the final height from first paint; the iframe exists only once it nears the viewport. -->
<div
  bind:this={slot}
  class="slot preview--{height}"
  style:block-size={blockSize}
  data-tx-preview-slot={componentId}
  data-focused={focused ? 'true' : undefined}
>
  {#if src}
    <iframe
      bind:this={frame}
      class="preview"
      {src}
      {title}
      data-tx-preview-frame={componentId}
      data-loaded="true"
      data-ready={ready ? 'true' : 'false'}
      inert={!interactive}
      aria-hidden={interactive ? undefined : 'true'}
      tabindex={interactive ? undefined : -1}
    ></iframe>
  {/if}
</div>

<style>
  .slot {
    display: block;
    inline-size: 100%;
  }
  .preview {
    display: block;
    inline-size: 100%;
    block-size: 100%;
    border: 0;
    border-radius: inherit;
    background: transparent;
    color-scheme: normal;
  }
  /* Focus inside the preview focuses the iframe in this document: ring it. */
  .preview:focus,
  .slot:focus-within,
  .slot[data-focused='true'] {
    outline: 2px solid var(--tx-ring, Highlight);
    outline-offset: 2px;
  }
  .preview--sm {
    block-size: 200px;
  }
  .preview--md {
    block-size: 280px;
  }
  .preview--lg {
    block-size: 360px;
  }
  .preview--xl {
    block-size: 460px;
  }
</style>
