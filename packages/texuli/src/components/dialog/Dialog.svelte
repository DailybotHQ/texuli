<script lang="ts">
import type { FocusRestoreEvent } from '@texuli/core/focus-scope';
import type { LayerStack } from '@texuli/core/layer-stack';
import type { OverlayDismissEvent, OverlayMode } from '@texuli/core/overlay';
import type { PortalTarget } from '@texuli/core/portal';
import * as DialogPrimitive from '@texuli/primitives/dialog';
import type { Snippet } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';
import { type ClassValue } from '../../internal/cx.ts';
import type { MotionProp } from '../../motion/contract.ts';
import { createOverlayMotion } from '../../motion/seam.ts';
import { Icon } from '../icons/index.ts';
import {
  type DialogSize,
  dialogBodyClass,
  dialogCloseClass,
  dialogContentClass,
  dialogDescriptionClass,
  dialogFooterClass,
  dialogHeaderClass,
  dialogOverlayClass,
  dialogTitleClass,
} from './variants.ts';
import './dialog.css';

type TriggerSnippet = Snippet<[{ props: Record<string, unknown> }]>;

type OwnProps = {
  open?: boolean;
  /** Required accessible title. */
  title: string;
  description?: string;
  size?: DialogSize;
  /** Spread `props` onto your trigger: `{#snippet trigger({ props })}<Button {...props}>…`. */
  trigger?: TriggerSnippet;
  footer?: Snippet;
  children?: Snippet;
  hideClose?: boolean;
  /** Accessible name of the header close control. */
  closeLabel?: string;
  onOpenChange?: (open: boolean) => void;
  class?: ClassValue;
  /** Mount the portal somewhere other than document.body (scoped previews). */
  portal?: PortalTarget;
  /**
   * The layer stack (`@texuli/core/layer-stack`) this overlay registers on, for
   * apps that keep their own Escape and outside-press order. Default: the
   * page-wide stack. Read when the dialog opens.
   */
  stack?: LayerStack;
  /**
   * `'top-layer'` (default) or `'contained'`: with a `container`, the overlay
   * renders inside it, and inertness, focus containment and the backdrop stay
   * scoped to it (document scrolling is left alone). For framed previews.
   */
  mode?: OverlayMode;
  /** The element a `'contained'` overlay renders in and is scoped to. */
  container?: Element | null;
  /**
   * Called before an Escape, outside press or outside focus closes it;
   * `event.preventDefault()` keeps it open.
   */
  onDismissRequest?: (event: OverlayDismissEvent) => void;
  /**
   * Called before focus returns on close; `event.preventDefault()` keeps
   * focus where it is (move it yourself to redirect).
   */
  onCloseAutoFocus?: (event: FocusRestoreEvent) => void;
  /**
   * Enter and exit motion (`texuli/motion`): default a scale-and-fade on the
   * panel and a fade on the backdrop; `false` for none. Reduced motion and a
   * `MotionProvider` level of `none` make it instant.
   */
  motion?: MotionProp;
  /** The dialog content element while open, `null` while closed (bindable). */
  ref?: HTMLElement | null;
};

/** Extra attributes (`data-*`, `aria-*`, `id`, handlers…) land on the dialog content element. */
type Props = OwnProps & Omit<HTMLAttributes<HTMLDivElement>, keyof OwnProps | 'role'>;

let {
  open = $bindable(false),
  title,
  description,
  size = 'md',
  trigger,
  footer,
  children,
  hideClose = false,
  closeLabel = 'Close',
  onOpenChange,
  class: className,
  portal,
  stack,
  mode = 'top-layer',
  container = null,
  onDismissRequest,
  onCloseAutoFocus,
  motion,
  ref = $bindable(null),
  ...rest
}: Props = $props();

const panelMotion = createOverlayMotion({
  motion: () => motion,
  defaults: { enter: 'scale', exit: 'scale', duration: 'base' },
});
const backdropMotion = createOverlayMotion({
  motion: () => (motion === false ? false : { duration: motion?.duration ?? 'base' }),
  defaults: { enter: 'fade', exit: 'fade' },
});

function bindRef(node: HTMLElement): () => void {
  ref = node;
  return () => {
    if (ref === node) ref = null;
  };
}

const contentClass = $derived(
  dialogContentClass({
    size,
    class: className,
  })
);

function setOpen(next: boolean): void {
  if (open === next) return;
  open = next;
  onOpenChange?.(next);
}
</script>

<DialogPrimitive.Root
  bind:open
  onOpenChange={setOpen}
  {stack}
  {mode}
  {container}
  {...onDismissRequest ? { onDismissRequest } : {}}
  {...onCloseAutoFocus ? { onCloseAutoFocus } : {}}
>
  {#if trigger}
    <DialogPrimitive.Trigger>
      {#snippet child({ props })}
        {@render trigger({ props })}
      {/snippet}
    </DialogPrimitive.Trigger>
  {/if}
  <DialogPrimitive.Portal to={portal}>
    <DialogPrimitive.Overlay
      class={dialogOverlayClass()}
      data-tx-dialog-overlay=""
      motionHooks={backdropMotion}
    />
    <DialogPrimitive.Content
      {...rest}
      class={contentClass}
      data-tx-dialog=""
      data-size={size}
      data-state={open ? 'open' : 'closed'}
      motionHooks={panelMotion}
      {@attach bindRef}
    >
      <div class={dialogHeaderClass()} data-tx-dialog-header="">
        <div class="tx-dialog__heading">
          <DialogPrimitive.Title class={dialogTitleClass()}>{title}</DialogPrimitive.Title>
          {#if description}
            <DialogPrimitive.Description class={dialogDescriptionClass()}>
              {description}
            </DialogPrimitive.Description>
          {/if}
        </div>
        {#if !hideClose}
          <DialogPrimitive.Close class={dialogCloseClass()} data-tx-dialog-close="" type="button">
            <Icon icon="close" size="sm" aria-hidden="true" />
            <span class="tx-dialog__close-label">{closeLabel}</span>
          </DialogPrimitive.Close>
        {/if}
      </div>
      {#if children}
        <div class={dialogBodyClass()} data-tx-dialog-body="">{@render children()}</div>
      {/if}
      {#if footer}
        <div class={dialogFooterClass()} data-tx-dialog-footer="">{@render footer()}</div>
      {:else}
        <div class="tx-dialog__footer-spacer" aria-hidden="true"></div>
      {/if}
    </DialogPrimitive.Content>
  </DialogPrimitive.Portal>
</DialogPrimitive.Root>
