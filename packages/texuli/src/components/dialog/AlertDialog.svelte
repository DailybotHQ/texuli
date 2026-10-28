<script lang="ts">
import type { OverlayDismissEvent } from '@texuli/core/overlay';
import type { PortalTarget } from '@texuli/core/portal';
import * as AlertDialogPrimitive from '@texuli/primitives/alert-dialog';
import type { Snippet } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';
import { type ClassValue } from '../../internal/cx.ts';
import { buttonVariants } from '../button/index.ts';
import {
  alertDialogActionsClass,
  alertDialogContentClass,
  alertDialogErrorClass,
  alertDialogIconClass,
  dialogDescriptionClass,
  dialogOverlayClass,
  dialogTitleClass,
} from './variants.ts';
import './dialog.css';
import '../button/button.css';

type TriggerSnippet = Snippet<[{ props: Record<string, unknown> }]>;

type OwnProps = {
  open?: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Styles the confirm action as destructive and shows a warning icon. */
  destructive?: boolean;
  /**
   * May return a promise: the dialog shows pending on confirm and closes once
   * it resolves. On rejection the dialog stays open with an error message.
   */
  onConfirm?: () => void | Promise<void>;
  onCancel?: () => void;
  trigger?: TriggerSnippet;
  /** Extra content between the description and the actions. */
  children?: Snippet;
  class?: ClassValue;
  /** Fallback error copy when `onConfirm` rejects without a message. */
  errorFallback?: string;
  onOpenChange?: (open: boolean) => void;
  /** Mount the portal somewhere other than document.body (scoped previews). */
  portal?: PortalTarget;
  /** The alert dialog content element while open, `null` while closed (bindable). */
  ref?: HTMLElement | null;
};

/** Extra attributes (`data-*`, `aria-*`, `id`, handlers…) land on the alert dialog content element. */
type Props = OwnProps & Omit<HTMLAttributes<HTMLDivElement>, keyof OwnProps | 'role'>;

let {
  open = $bindable(false),
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  destructive = false,
  onConfirm,
  onCancel,
  trigger,
  children,
  class: className,
  errorFallback = 'The action failed. Please try again.',
  onOpenChange,
  portal,
  ref = $bindable(null),
  ...rest
}: Props = $props();

function bindRef(node: HTMLElement): () => void {
  ref = node;
  return () => {
    if (ref === node) ref = null;
  };
}

let pending = $state(false);
let error = $state<string | null>(null);

const contentClass = $derived(
  alertDialogContentClass({
    destructive,
    class: className,
  })
);

const cancelClass = $derived(buttonVariants({ variant: 'outline', size: 'md' }));
const confirmClass = $derived(
  buttonVariants({ variant: destructive ? 'destructive' : 'default', size: 'md' })
);

function setOpen(next: boolean): void {
  if (!next) {
    if (pending) return;
    error = null;
  }
  if (open === next) return;
  open = next;
  onOpenChange?.(next);
}

/**
 * While the confirm is pending the dialog must not dismiss: the primitive
 * closes itself on Escape, so this veto is the only place the pending guard
 * still holds (the Cancel control and backdrop are already inert).
 */
function handleDismiss(event: OverlayDismissEvent): void {
  if (pending) event.preventDefault();
}

async function confirm(event: MouseEvent): Promise<void> {
  // Keep the primitive Action from closing before async work finishes.
  event.preventDefault();
  if (pending) return;
  error = null;
  pending = true;
  try {
    await onConfirm?.();
    open = false;
    onOpenChange?.(false);
  } catch (cause) {
    error = cause instanceof Error && cause.message ? cause.message : errorFallback;
  } finally {
    pending = false;
  }
}

function cancel(): void {
  if (pending) return;
  onCancel?.();
}
</script>

<AlertDialogPrimitive.Root bind:open onOpenChange={setOpen} onDismissRequest={handleDismiss}>
  {#if trigger}
    <AlertDialogPrimitive.Trigger>
      {#snippet child({ props })}
        {@render trigger({ props })}
      {/snippet}
    </AlertDialogPrimitive.Trigger>
  {/if}
  <AlertDialogPrimitive.Portal to={portal}>
    <AlertDialogPrimitive.Overlay class={dialogOverlayClass()} data-tx-alert-dialog-overlay="" />
    <AlertDialogPrimitive.Content
      {...rest}
      class={contentClass}
      data-tx-alert-dialog=""
      data-destructive={destructive ? 'true' : undefined}
      data-state={open ? 'open' : 'closed'}
      aria-busy={pending || undefined}
      {@attach bindRef}
    >
      <div class="tx-alert-dialog__row">
        {#if destructive}
          <div class={alertDialogIconClass()} aria-hidden="true" data-tx-alert-dialog-icon="">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 3 2 21h20L12 3Z" stroke-linejoin="round" />
              <path d="M12 10v5" stroke-linecap="round" />
              <circle cx="12" cy="18" r="1" fill="currentColor" stroke="none" />
            </svg>
          </div>
        {/if}
        <div class="tx-alert-dialog__copy">
          <AlertDialogPrimitive.Title class={dialogTitleClass()}>{title}</AlertDialogPrimitive.Title>
          {#if description}
            <AlertDialogPrimitive.Description class={dialogDescriptionClass()}>
              {description}
            </AlertDialogPrimitive.Description>
          {/if}
          {#if children}
            <div class="tx-alert-dialog__extra">{@render children()}</div>
          {/if}
        </div>
      </div>

      {#if error}
        <p class={alertDialogErrorClass()} role="alert" data-tx-alert-dialog-error="">{error}</p>
      {/if}

      <div class={alertDialogActionsClass()} data-tx-alert-dialog-actions="">
        <AlertDialogPrimitive.Cancel
          class={cancelClass}
          disabled={pending}
          data-tx-alert-dialog-cancel=""
          onclick={() => cancel()}
        >
          {cancelLabel}
        </AlertDialogPrimitive.Cancel>
        <AlertDialogPrimitive.Action
          class={confirmClass}
          disabled={pending}
          aria-busy={pending || undefined}
          data-tx-alert-dialog-action=""
          data-loading={pending ? 'true' : undefined}
          onclick={(event) => void confirm(event)}
        >
          {confirmLabel}
        </AlertDialogPrimitive.Action>
      </div>
    </AlertDialogPrimitive.Content>
  </AlertDialogPrimitive.Portal>
</AlertDialogPrimitive.Root>
