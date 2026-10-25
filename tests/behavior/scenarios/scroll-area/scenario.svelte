<script lang="ts">
import { ScrollArea } from '@texuli/primitives/scroll-area';

const items = Array.from({ length: 40 }, (_, i) => `Message ${i + 1} · example.com`);
</script>

<section data-behavior="scenario" aria-label="ScrollArea">
  <div style="block-size: 10rem; inline-size: 18rem; border: 1px solid CanvasText;">
    <ScrollArea.Root type="always" aria-label="Message list" style="block-size: 10rem;">
      <ScrollArea.Viewport style="block-size: 10rem;">
        <ul style="margin: 0; padding: 0.5rem; list-style: none;">
          {#each items as item (item)}
            <li style="padding-block: 0.35rem;">{item}</li>
          {/each}
        </ul>
      </ScrollArea.Viewport>
      <ScrollArea.Scrollbar orientation="vertical" style="inline-size: 0.5rem;">
        <ScrollArea.Thumb
          style="block-size: var(--tx-sa-thumb-size-y); margin-block-start: var(--tx-sa-thumb-offset-y); background: GrayText; border-radius: 999px;"
        />
      </ScrollArea.Scrollbar>
      <ScrollArea.Corner />
    </ScrollArea.Root>
  </div>
</section>
