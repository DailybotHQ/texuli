<script lang="ts">
import { Button } from '../../src/components/button/index.ts';
import { AlertDialog } from '../../src/components/dialog/index.ts';
import { Input } from '../../src/components/input/index.ts';

let {
  open = $bindable(false),
  title = 'Delete project?',
  description = 'This removes the Harbor Labs project from every member workspace.',
  confirmLabel = 'Delete',
  cancelLabel = 'Keep project',
  destructive = true,
  fail = false,
  confirmText,
  onConfirm,
  onCancel,
}: {
  open?: boolean;
  title?: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  fail?: boolean;
  /** Renders a typed confirmation: confirm stays disabled until it matches. */
  confirmText?: string;
  onConfirm?: () => void | Promise<void>;
  onCancel?: () => void;
} = $props();

let typed = $state('');

async function confirm(): Promise<void> {
  if (onConfirm) {
    await onConfirm();
    return;
  }
  if (fail) {
    throw new Error('Harbor could not delete the project.');
  }
}
</script>

<AlertDialog
  bind:open
  {title}
  {description}
  {confirmLabel}
  {cancelLabel}
  {destructive}
  confirmDisabled={confirmText !== undefined && typed !== confirmText}
  onConfirm={confirm}
  {onCancel}
>
  {#if confirmText !== undefined}
    <Input bind:value={typed} aria-label={`Type ${confirmText} to confirm`} />
  {/if}
  {#snippet trigger({ props })}
    <Button {...props} variant="destructive">Delete project</Button>
  {/snippet}
</AlertDialog>
