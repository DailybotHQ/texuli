<script lang="ts">
import { FileDrop } from '@texuli/primitives/file-drop';

/**
 * OS file drop is a different interaction kind: files come from the
 * operating system, so it is not @texuli/drag. Nothing is uploaded; the
 * names stay in this page.
 */
let files = $state<File[]>([]);
</script>

<div class="file-drop">
  <FileDrop.Root
    bind:files
    accept="text/plain,.md,.csv"
    label="Attach notes"
    inputLabel="Choose files"
    maxFiles={3}
    maxSize={65536}
  >
    {#snippet children({ files: chosen })}
      {#if chosen.length > 0}
        <ul class="file-drop__list" aria-label="Chosen files">
          {#each chosen as file, index (index)}
            <li>{file.name}</li>
          {/each}
        </ul>
      {/if}
    {/snippet}
  </FileDrop.Root>
</div>

<style>
  .file-drop__list {
    margin: 0.5rem 0 0;
    padding-inline-start: 1.25rem;
  }
</style>
