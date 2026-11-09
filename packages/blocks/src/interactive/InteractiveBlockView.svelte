<script lang="ts">
import { localizeLabels } from '@texuli/core/i18n';
import { useMessages } from 'texuli/i18n';
import CalculatorBlockView from './CalculatorBlock.svelte';
import ChecklistBlockView from './ChecklistBlock.svelte';
import { checkInteractiveBlock } from './check.ts';
import type { InteractiveBlockViewProps } from './family.ts';
import { DEFAULT_INTERACTIVE_BLOCK_LABELS, resolveInteractiveBlockLabels } from './labels.ts';
import PollBlockView from './PollBlock.svelte';
import QuizBlockView from './QuizBlock.svelte';
import './interactive.css';

let { block, labels, oninvalid }: InteractiveBlockViewProps = $props();

const check = $derived(checkInteractiveBlock(block));
const msg = useMessages();
const text = $derived(
  resolveInteractiveBlockLabels(
    labels,
    localizeLabels(msg, 'blocks.interactive', DEFAULT_INTERACTIVE_BLOCK_LABELS)
  )
);

$effect(() => {
  if (!check.ok) oninvalid?.(check.issues);
});
</script>

{#if !check.ok}
  <p class="tx-block tx-block-invalid" role="note" data-tx-block="invalid" data-tx-component="blocks-interactive">{text.invalid}</p>
{:else if check.block.type === 'poll'}
  <PollBlockView block={check.block} labels={text} />
{:else if check.block.type === 'quiz'}
  <QuizBlockView block={check.block} labels={text} />
{:else if check.block.type === 'calculator'}
  <CalculatorBlockView block={check.block} labels={text} />
{:else if check.block.type === 'checklist'}
  <ChecklistBlockView block={check.block} labels={text} />
{/if}
