<script lang="ts">
import { FileDrop } from '@texuli/primitives/file-drop';

let files = $state<File[]>([]);
</script>

<FileDrop.Root
  bind:files
  accept="text/plain,.md"
  label="Attach documents"
  inputLabel="Choose files"
  maxFiles={2}
  maxSize={32}
>
  {#snippet children({ files: selected })}
    <ul aria-label="Selected documents">
      {#each selected as file, index (index)}
        <li>{file.name}</li>
      {/each}
    </ul>
  {/snippet}
</FileDrop.Root>
