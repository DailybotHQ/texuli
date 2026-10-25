<script lang="ts">
import { FileDrop } from '@texuli/primitives/file-drop';

let files = $state<File[]>([]);
</script>

<FileDrop.Root
  bind:files
  accept="text/plain,.md"
  label="Attach documents"
  inputLabel="Choose documents"
  maxFiles={3}
  maxSize={8}
>
  {#snippet child({ props })}
    <input {...props} data-testid="custom-file-input" />
  {/snippet}
  {#snippet children({ files: selected, dragging, removeFile })}
    <ul aria-label="Selected documents" data-dragging={dragging ? 'true' : 'false'}>
      {#each selected as file, index (index)}
        <li>
          {file.name}
          <button type="button" onclick={() => removeFile(file)}>Remove {file.name}</button>
        </li>
      {/each}
    </ul>
  {/snippet}
</FileDrop.Root>

<FileDrop.Root label="Locked uploads" disabled />
