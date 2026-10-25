<script lang="ts">
import { getInertRegistry } from '@texuli/core/inert';
import type { Snippet } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';
import { getToastProviderContext, setToastViewportContext } from './context.ts';

type Props = HTMLAttributes<HTMLElement> & {
  /** Max visible toasts (default all queued). */
  hotkeyLabel?: string;
  children?: Snippet;
};

let { class: className, hotkeyLabel, children, ...rest }: Props = $props();

const provider = getToastProviderContext();
let regionEl: HTMLElement | null = $state(null);

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

  provider.setFocusHandler(() => {
    const focusable = node.querySelector<HTMLElement>(
      'button:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex="-1"])'
    );
    focusable?.focus();
  });

  return () => {
    doc.removeEventListener('toggle', onToggle, true);
    provider.setFocusHandler(null);
    exemption?.release();
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
  popover="manual"
  role="region"
  aria-label={provider.label}
  data-tx-toast-viewport
  data-state={provider.manager.list().length > 0 ? 'visible' : 'empty'}
  tabindex="-1"
  onpointerenter={onPointerEnter}
  onpointerleave={onPointerLeave}
  onfocusin={onFocusIn}
  onfocusout={onFocusOut}
>
  {#if hotkeyLabel}
    <span data-tx-toast-hotkey-hint class="tx-toast-hotkey-hint">{hotkeyLabel}</span>
  {/if}
  {@render children?.()}
</section>
