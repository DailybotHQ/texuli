<script lang="ts">
import { Button } from 'texuli/button';
import { RadioGroup } from 'texuli/choice';
import type { InteractiveBlockLabels } from './labels.ts';
import type { QuizBlock as QuizBlockData } from './schema.ts';

let {
  block,
  labels,
}: {
  block: QuizBlockData;
  labels: InteractiveBlockLabels;
} = $props();

let index = $state(0);
let choice = $state('');
let checked = $state(false);
let score = $state(0);
let done = $state(false);

const question = $derived(block.questions[index]);
const total = $derived(block.questions.length);

function checkAnswer(): void {
  if (!question || !choice || checked) return;
  checked = true;
  if (choice === question.correctId) score += 1;
}

function next(): void {
  if (!checked) return;
  if (index + 1 >= total) {
    done = true;
    return;
  }
  index += 1;
  choice = '';
  checked = false;
}
</script>

<div class="tx-block-interactive" data-tx-block="quiz" data-tone={block.tone}>
  {#if block.title}
    <h3 class="tx-block-interactive__title">{block.title}</h3>
  {/if}

  {#if done}
    <p class="tx-block-interactive__result" aria-live="polite">
      {labels.quizScore}: {score} / {total}
    </p>
  {:else if question}
    <p class="tx-block-interactive__prompt" id="{question.id}-prompt">
      {index + 1}. {question.prompt}
    </p>
    <RadioGroup
      bind:value={choice}
      disabled={checked}
      items={question.options.map((o) => ({ value: o.id, label: o.label }))}
      aria-labelledby="{question.id}-prompt"
    />
    <div class="tx-block-interactive__actions">
      {#if !checked}
        <Button type="button" onclick={checkAnswer} disabled={!choice}>{labels.quizSubmit}</Button>
      {:else}
        <p class="tx-block-interactive__result" aria-live="polite">
          {choice === question.correctId ? labels.quizCorrect : labels.quizIncorrect}
          {#if question.explanation}
            — {question.explanation}
          {/if}
        </p>
        <Button type="button" onclick={next}>{labels.quizNext}</Button>
      {/if}
    </div>
  {/if}
</div>
