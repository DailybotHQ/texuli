<script lang="ts">
import type { InteractiveBlockLabels } from './labels.ts';
import { type CalculatorBlock, evaluateCalculator } from './schema.ts';

let {
  block,
  labels,
}: {
  block: CalculatorBlock;
  labels: InteractiveBlockLabels;
} = $props();

let values = $state<Record<string, number | null>>({});
let seeded = false;
$effect.pre(() => {
  if (seeded) return;
  values = Object.fromEntries(
    block.inputs.map((input) => [input.name, input.default ?? input.min ?? 0])
  );
  seeded = true;
});

const evaluation = $derived(evaluateCalculator(block, values));

function onInput(name: string, event: Event): void {
  const raw = (event.currentTarget as HTMLInputElement).value;
  const n = Number(raw);
  values = { ...values, [name]: Number.isFinite(n) ? n : null };
}
</script>

<div class="tx-block-interactive" data-tx-block="calculator" data-tone={block.tone}>
  {#if block.title}
    <h3 class="tx-block-interactive__title">{block.title}</h3>
  {/if}
  {#if block.description}
    <p class="tx-block-interactive__prompt">{block.description}</p>
  {/if}

  <div class="tx-block-interactive__inputs">
    {#each block.inputs as input (input.name)}
      <label class="tx-block-interactive__field">
        <span>{input.label}</span>
        <input
          type="number"
          name={input.name}
          value={values[input.name] ?? ''}
          min={input.min}
          max={input.max}
          step={input.step ?? 'any'}
          oninput={(event) => onInput(input.name, event)}
        />
      </label>
    {/each}
  </div>

  <p class="tx-block-interactive__result" aria-live="polite" data-tx-calculator-result>
    {block.outputLabel ?? labels.calculatorResult}:
    {evaluation.ok ? evaluation.formatted : evaluation.message}
  </p>
</div>
