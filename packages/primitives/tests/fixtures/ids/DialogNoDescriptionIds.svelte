<script lang="ts">
import * as Dialog from '../../../src/dialog/index.ts';
</script>

<!-- No Description: the content must not point aria-describedby at nothing. -->
<Dialog.Root>
  <Dialog.Trigger id="rename-trigger">Rename</Dialog.Trigger>
  <Dialog.Portal>
    <Dialog.Content id="rename-dialog">
      <Dialog.Title id="rename-title">Rename file</Dialog.Title>
      <Dialog.Close>Done</Dialog.Close>
    </Dialog.Content>
  </Dialog.Portal>
</Dialog.Root>
