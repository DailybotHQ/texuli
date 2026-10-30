<script lang="ts">
import { getInertRegistry } from '@texuli/core/inert';
import { createPortal } from '@texuli/core/portal';
import type { Snippet } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';
import { ensurePositioned } from '../internal/backdrop.ts';
import { chainHandlers } from '../internal/handlers.ts';
import type { RefProp } from '../internal/ref.ts';
import { getToastProviderContext, setToastViewportContext } from './context.ts';

type Props = HTMLAttributes<HTMLElement> & {
  /** Max visible toasts (default all queued). */
  hotkeyLabel?: string;
  children?: Snippet;
  /**
   * `'top-layer'` (default): the region is a manual popover in the top layer.
   * `'contained'`: it never enters the top layer; it renders where it is
   * mounted, or inside `container` (which becomes its containing block), for
   * framed previews.
   */
  mode?: 'top-layer' | 'contained';
  /** The element a `'contained'` region renders in. */
  container?: Element | null;
  /**
   * Contained mode: the caller declares `container` already positioned (a
   * containing block), so its computed style is never read. Default `false`:
   * one frame after mount the container's computed position is read, and a
   * static container gets `position: relative` (restored on unmount). The
   * read never runs during the first render, where it would force a layout.
   */
  positioned?: boolean;
  /**
   * Whether a top-layer region is shown (default `true`). Pass `false` while
   * there is nothing to show: an empty region then stays out of the top layer
   * (and out of the page) instead of sitting at the viewport corner.
   */
  active?: boolean;
} & RefProp;

let {
  class: className,
  hotkeyLabel,
  children,
  mode = 'top-layer',
  container = null,
  positioned = false,
  active = true,
  ref = $bindable(null),
  onpointerenter,
  onpointerleave,
  onfocusin,
  onfocusout,
  ...rest
}: Props = $props();

const provider = getToastProviderContext();
let regionEl: HTMLElement | null = $state(null);
// `ref` follows the element the part binds for its own behavior.
$effect(() => {
  ref = regionEl ?? null;
});

setToastViewportContext({
  element: () => regionEl,
});

$effect(() => {
  const node = regionEl;
  if (!node) return;

  // R16: stay interactive under modals.
  let exemption: { release: () => void } | null = null;
  try {
    exemption = getInertRegistry().exempt({ element: node, label: 'toast-region' });
  } catch {
    exemption = null;
  }

  provider.setFocusHandler(() => {
    const focusable = node.querySelector<HTMLElement>(
      'button:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex="-1"])'
    );
    focusable?.focus();
  });

  return () => {
    provider.setFocusHandler(null);
    exemption?.release();
  };
});

// Contained: render inside the container (a containing block), never in the top layer.
$effect(() => {
  const node = regionEl;
  const target = container;
  if (!node || mode !== 'contained' || !target) return;
  const portal = createPortal(node, { target });
  // The container must be a containing block. Reading its computed position
  // forces a layout, so it never runs during the first render (G99): it waits
  // for the next frame, and is skipped when the caller declares it positioned.
  let restorePosition = () => {};
  let cancelRead = () => {};
  if (!positioned) {
    const view = target.ownerDocument.defaultView;
    const read = () => {
      cancelRead = () => {};
      restorePosition = ensurePositioned(target);
    };
    if (view && typeof view.requestAnimationFrame === 'function') {
      const frame = view.requestAnimationFrame(read);
      cancelRead = () => view.cancelAnimationFrame(frame);
    } else {
      const timer = setTimeout(read, 0);
      cancelRead = () => clearTimeout(timer);
    }
  }
  return () => {
    cancelRead();
    portal.destroy();
    restorePosition();
  };
});

$effect(() => {
  const node = regionEl;
  if (!node || mode !== 'top-layer' || !active) return;

  // Top-layer popover when supported.
  try {
    if (typeof node.showPopover === 'function' && !node.matches(':popover-open')) {
      node.showPopover();
    }
  } catch {
    // Older engines: fixed positioning from the host CSS is enough.
  }

  // R16 for pointers too: a popover opened later (a modal's overlay and
  // content) would stack above the region in the top layer. When one opens,
  // re-enter the top layer so the toasts stay on top and clickable.
  // `toggle` does not bubble, so listen in the capture phase.
  const doc = node.ownerDocument;
  const onToggle = (event: Event) => {
    const target = event.target;
    if (target === node || !(target instanceof Element)) return;
    // Other toast regions re-raise themselves too: ignoring them avoids a loop.
    if (target.hasAttribute('data-tx-toast-viewport')) return;
    if ((event as ToggleEvent).newState !== 'open') return;
    try {
      if (!node.matches(':popover-open')) return;
      node.hidePopover();
      node.showPopover();
    } catch {
      // Engines without popovers keep the fixed host positioning.
    }
  };
  doc.addEventListener('toggle', onToggle, true);

  return () => {
    doc.removeEventListener('toggle', onToggle, true);
    try {
      if (typeof node.hidePopover === 'function' && node.matches(':popover-open')) {
        node.hidePopover();
      }
    } catch {
      // ignore
    }
  };
});

function onPointerEnter(): void {
  provider.pauseAll();
}

function onPointerLeave(event: PointerEvent): void {
  const node = regionEl;
  const next = event.relatedTarget;
  if (node && next instanceof Node && node.contains(next)) return;
  provider.resumeAll();
}

function onFocusIn(): void {
  provider.pauseAll();
}

function onFocusOut(event: FocusEvent): void {
  const node = regionEl;
  const next = event.relatedTarget;
  if (node && next instanceof Node && node.contains(next)) return;
  provider.resumeAll();
}
</script>

<!-- svelte-ignore a11y_no_redundant_roles -->
<section
  bind:this={regionEl}
  {...rest}
  class={typeof className === 'string' ? className : undefined}
  popover={mode === 'top-layer' ? 'manual' : undefined}
  data-mode={mode}
  role="region"
  aria-label={provider.label}
  data-tx-toast-viewport
  data-state={provider.manager.list().length > 0 ? 'visible' : 'empty'}
  tabindex="-1"
  onpointerenter={chainHandlers(onpointerenter, onPointerEnter)}
  onpointerleave={chainHandlers(onpointerleave, onPointerLeave)}
  onfocusin={chainHandlers(onfocusin, onFocusIn)}
  onfocusout={chainHandlers(onfocusout, onFocusOut)}
>
  {#if hotkeyLabel}
    <span data-tx-toast-hotkey-hint class="tx-toast-hotkey-hint">{hotkeyLabel}</span>
  {/if}
  {@render children?.()}
</section>
