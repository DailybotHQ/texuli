<script lang="ts">
import CalculatorBlockView from './CalculatorBlock.svelte';
import ChecklistBlockView from './ChecklistBlock.svelte';
import { checkInteractiveBlock } from './check.ts';
import type { InteractiveBlockViewProps } from './family.ts';
import { resolveInteractiveBlockLabels } from './labels.ts';
import PollBlockView from './PollBlock.svelte';
import QuizBlockView from './QuizBlock.svelte';
import './interactive.css';

let { block, labels, oninvalid }: InteractiveBlockViewProps = $props();

const check = $derived(checkInteractiveBlock(block));
const text = $derived(resolveInteractiveBlockLabels(labels));

$effect(() => {
  if (!check.ok) oninvalid?.(check.issues);
});
</script>

{#if !check.ok}
  <p class="tx-block tx-block-invalid" role="note" data-tx-block="invalid">{text.invalid}</p>
{:else if check.block.type === 'poll'}
  <PollBlockView block={check.block} labels={text} />
{:else if check.block.type === 'quiz'}
  <QuizBlockView block={check.block} labels={text} />
{:else if check.block.type === 'calculator'}
  <CalculatorBlockView block={check.block} labels={text} />
{:else if check.block.type === 'checklist'}
  <ChecklistBlockView block={check.block} labels={text} />
{/if}
