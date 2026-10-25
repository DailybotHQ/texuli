<script lang="ts">
import * as Dialog from '../../../src/dialog/index.ts';
</script>

<Dialog.Root>
  <Dialog.Trigger id="edit-trigger">Edit profile</Dialog.Trigger>
  <Dialog.Portal>
    <Dialog.Content id="edit-dialog">
      <Dialog.Title id="edit-title">Edit profile</Dialog.Title>
      <Dialog.Description id="edit-description">Change your fictional details.</Dialog.Description>
      <Dialog.Close>Done</Dialog.Close>
    </Dialog.Content>
  </Dialog.Portal>
</Dialog.Root>
