<script lang="ts">
import type { ImageEditorProps } from './Editor.svelte';

/**
 * The public image editor. The editor itself (controls, preview, history,
 * export) loads as a separate chunk, so pages pay for it only where it is
 * mounted; this shell shows a status until it arrives.
 */
type Props = ImageEditorProps;

let { value = $bindable(), ...props }: Props = $props();

const editor = import('./Editor.svelte');
</script>

{#await editor}
  <p class="tx-image-editor-pending" role="status">{props.labels?.loading ?? 'Loading image…'}</p>
{:then module}
  <module.default bind:value {...props} />
{:catch}
  <p class="tx-image-editor-pending" role="alert">
    {props.labels?.unavailable ?? 'This image could not be loaded.'}
  </p>
{/await}

<style>
  @layer tx.components {
    .tx-image-editor-pending {
      margin: 0;
      font-size: 0.8125rem;
      color: var(--tx-muted-foreground, light-dark(#52525b, #a1a1aa));
    }
  }
</style>
