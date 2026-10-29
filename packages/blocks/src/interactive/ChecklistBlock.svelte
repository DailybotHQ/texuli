<script lang="ts">
import { Checkbox } from 'texuli/choice';
import type { InteractiveBlockLabels } from './labels.ts';
import type { ChecklistBlock as ChecklistBlockData } from './schema.ts';

let {
  block,
  labels,
}: {
  block: ChecklistBlockData;
  labels: InteractiveBlockLabels;
} = $props();

let done = $state<Record<string, boolean>>({});
let seeded = false;
$effect.pre(() => {
  if (seeded) return;
  done = Object.fromEntries(block.items.map((item) => [item.id, item.done === true]));
  seeded = true;
});

const completed = $derived(Object.values(done).filter(Boolean).length);
const total = $derived(block.items.length);
</script>

<div class="tx-block-interactive" data-tx-block="checklist" data-tone={block.tone}>
  {#if block.title}
    <h3 class="tx-block-interactive__title">{block.title}</h3>
  {/if}
  <p class="tx-block-interactive__prompt" aria-live="polite">
    {labels.checklistProgress}: {completed} / {total}
  </p>
  <div class="tx-block-interactive__options" role="group" aria-label={block.title ?? 'Checklist'}>
    {#each block.items as item (item.id)}
      <Checkbox
        checked={done[item.id] === true}
        label={item.label}
        onCheckedChange={(next) => {
          done = { ...done, [item.id]: next };
        }}
      />
    {/each}
  </div>
</div>
