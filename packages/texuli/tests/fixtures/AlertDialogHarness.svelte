<script lang="ts">
import { Button } from '../../src/components/button/index.ts';
import { AlertDialog } from '../../src/components/dialog/index.ts';

let {
  open = $bindable(false),
  title = 'Delete project?',
  description = 'This removes the Harbor Labs project from every member workspace.',
  confirmLabel = 'Delete',
  cancelLabel = 'Keep project',
  destructive = true,
  fail = false,
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
  onConfirm?: () => void | Promise<void>;
  onCancel?: () => void;
} = $props();

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
  onConfirm={confirm}
  {onCancel}
>
  {#snippet trigger({ props })}
    <Button {...props} variant="destructive">Delete project</Button>
  {/snippet}
</AlertDialog>
