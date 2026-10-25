<script lang="ts">
import * as Dialog from '@texuli/primitives/dialog';
import type { Snippet } from 'svelte';
import { Icon } from '../../components/icons/index.ts';
import { onNavigate } from './layout-kit.ts';
import './host.css';

/**
 * Navigation drawer a layout shows below its breakpoint.
 * Escape, close, backdrop, following a link, and in-app navigation close it.
 * Built on `@texuli/primitives/dialog`.
 */
type Props = {
  open?: boolean;
  label: string;
  closeLabel?: string;
  children: Snippet;
};

let { open = $bindable(false), label, closeLabel = 'Close navigation', children }: Props = $props();

let root = $state<HTMLElement | null>(null);

$effect(() => {
  if (!open) return;
  return onNavigate(() => {
    open = false;
  }, root);
});

function closeOnLink(event: MouseEvent): void {
  if (event.target instanceof Element && event.target.closest('a[href]')) open = false;
}

function setOpen(next: boolean): void {
  open = next;
}
</script>

<div bind:this={root} data-tx-layout-drawer-root="">
  <Dialog.Root bind:open onOpenChange={setOpen}>
    <Dialog.Portal>
      <Dialog.Overlay class="tx-layout-drawer-overlay" data-tx-layout-drawer-overlay="" />
      <Dialog.Content
        class="tx-layout-drawer"
        data-tx-layout-drawer=""
      >
        <Dialog.Title class="tx-layout-host__loading-label">{label}</Dialog.Title>
        <Dialog.Close class="tx-layout-drawer__close" data-tx-layout-drawer-close="" type="button">
          <Icon icon="close" size="md" aria-hidden="true" />
          <span class="tx-layout-host__loading-label">{closeLabel}</span>
        </Dialog.Close>
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div class="tx-layout-drawer__body" role="presentation" onclick={closeOnLink}>
          {@render children()}
        </div>
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>
</div>
