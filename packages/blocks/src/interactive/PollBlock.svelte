<script lang="ts">
import { Button } from 'texuli/button';
import { Checkbox, RadioGroup } from 'texuli/choice';
import type { InteractiveBlockLabels } from './labels.ts';
import type { PollBlock } from './schema.ts';

let {
  block,
  labels,
}: {
  block: PollBlock;
  labels: InteractiveBlockLabels;
} = $props();

let selected = $state<string[]>([]);
let radioValue = $state('');
let submitted = $state(false);

const multi = $derived(block.allowMultiple === true);
const qId = $derived(`${block.id ?? 'poll'}-q`);

function toggle(id: string, next: boolean): void {
  if (submitted) return;
  if (next) {
    if (!selected.includes(id)) selected = [...selected, id];
  } else {
    selected = selected.filter((x) => x !== id);
  }
}

function submit(): void {
  if (multi) {
    if (selected.length === 0) return;
  } else {
    if (!radioValue) return;
    selected = [radioValue];
  }
  submitted = true;
}

function reset(): void {
  selected = [];
  radioValue = '';
  submitted = false;
}

const counts = $derived.by(() => {
  const map = Object.fromEntries(block.options.map((o) => [o.id, 0])) as Record<string, number>;
  if (submitted) {
    for (const id of selected) {
      if (map[id] !== undefined) map[id] += 1;
    }
  }
  return map;
});

const total = $derived(submitted ? Math.max(1, selected.length) : 1);
</script>

<div class="tx-block-interactive" data-tx-block="poll" data-tone={block.tone}>
  <p class="tx-block-interactive__prompt" id={qId}>{block.question}</p>

  {#if multi}
    <div class="tx-block-interactive__options" role="group" aria-labelledby={qId}>
      {#each block.options as option (option.id)}
        <Checkbox
          checked={selected.includes(option.id)}
          disabled={submitted}
          label={option.label}
          onCheckedChange={(next) => toggle(option.id, next)}
        />
      {/each}
    </div>
  {:else}
    <RadioGroup
      bind:value={radioValue}
      disabled={submitted}
      items={block.options.map((o) => ({ value: o.id, label: o.label }))}
      aria-labelledby={qId}
    />
  {/if}

  <div class="tx-block-interactive__actions">
    {#if !submitted}
      <Button
        type="button"
        onclick={submit}
        disabled={multi ? selected.length === 0 : radioValue === ''}
      >
        {labels.pollSubmit}
      </Button>
    {:else}
      <Button type="button" variant="secondary" onclick={reset}>{labels.pollReset}</Button>
    {/if}
  </div>

  {#if submitted}
    <div class="tx-block-interactive__results" aria-live="polite">
      <p class="tx-block-interactive__result">{labels.pollResults}</p>
      {#each block.options as option (option.id)}
        {@const pct = Math.round(((counts[option.id] ?? 0) / total) * 100)}
        <div class="tx-block-interactive__bar">
          <span>{option.label} — {pct}%</span>
          <div class="tx-block-interactive__bar-track">
            <div class="tx-block-interactive__bar-fill" style:inline-size="{pct}%"></div>
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>
