<script lang="ts">
import * as AlertDialog from '../../../src/alert-dialog/index.ts';
</script>

<AlertDialog.Root>
  <AlertDialog.Trigger id="delete-trigger">Delete</AlertDialog.Trigger>
  <AlertDialog.Portal>
    <AlertDialog.Content id="delete-dialog">
      <AlertDialog.Title id="delete-title">Delete the draft?</AlertDialog.Title>
      <AlertDialog.Description id="delete-description">This cannot be undone.</AlertDialog.Description>
      <AlertDialog.Cancel>Cancel</AlertDialog.Cancel>
      <AlertDialog.Action>Delete</AlertDialog.Action>
    </AlertDialog.Content>
  </AlertDialog.Portal>
</AlertDialog.Root>
