<script lang="ts">
import { InteractiveBlockView } from '@texuli/blocks/interactive/renderers';

const poll = {
  type: 'poll',
  id: 'harbor-poll',
  question: 'Which fictional berth should open first?',
  options: [
    { id: 'a', label: 'North Pier' },
    { id: 'b', label: 'East Basin' },
    { id: 'c', label: 'West Quay' },
  ],
};

const quiz = {
  type: 'quiz',
  title: 'Beacon quiz',
  questions: [
    {
      id: 'color',
      prompt: 'What color is the story beacon?',
      options: [
        { id: 'red', label: 'Red' },
        { id: 'green', label: 'Green' },
      ],
      correctId: 'red',
      explanation: 'The fictional beacon is red.',
    },
  ],
};

const calculator = {
  type: 'calculator',
  title: 'Charter estimate',
  description: 'Hours × rate (cents). Example data only.',
  inputs: [
    { name: 'hours', label: 'Hours', default: 3, min: 1, max: 24, step: 1 },
    { name: 'rate', label: 'Rate (¢/h)', default: 2500, min: 0 },
  ],
  formula: {
    op: 'mul',
    left: { op: 'var', name: 'hours' },
    right: { op: 'var', name: 'rate' },
  },
  unit: 'cents',
  outputLabel: 'Estimate',
};

const checklist = {
  type: 'checklist',
  title: 'Pre-departure',
  items: [
    { id: 'charts', label: 'Charts updated' },
    { id: 'fuel', label: 'Fuel checked' },
    { id: 'crew', label: 'Crew briefed', done: true },
  ],
};
</script>

<section data-example="blocks-interactive" aria-labelledby="blocks-interactive-title">
  <h2 id="blocks-interactive-title">Interactive blocks</h2>
  <p>Poll, quiz, calculator and checklist from validated data. Fictional Harbor Notes only.</p>

  <h3>Poll</h3>
  <div data-axis="poll"><InteractiveBlockView block={poll} /></div>

  <h3>Quiz</h3>
  <div data-axis="quiz"><InteractiveBlockView block={quiz} /></div>

  <h3>Calculator</h3>
  <div data-axis="calculator"><InteractiveBlockView block={calculator} /></div>

  <h3>Checklist</h3>
  <div data-axis="checklist"><InteractiveBlockView block={checklist} /></div>

  <h3>RTL</h3>
  <div data-axis="rtl" dir="rtl" lang="ar">
    <InteractiveBlockView
      block={{
        type: 'poll',
        question: 'أي رصيف خيالي تفضل؟',
        options: [
          { id: 'a', label: 'الشمال' },
          { id: 'b', label: 'الجنوب' },
        ],
      }}
    />
  </div>

  <h3>Dark</h3>
  <div data-axis="dark" data-tx-mode="dark" class="dark-panel">
    <InteractiveBlockView block={checklist} />
  </div>
</section>

<style>
  section {
    display: grid;
    gap: 1.25rem;
    padding: 1rem;
    max-inline-size: 40rem;
  }

  .dark-panel {
    padding: 1rem;
    border-radius: var(--tx-radius, 0.5rem);
    background: var(--tx-background, #0a0a0a);
    color: var(--tx-foreground, #fafafa);
  }
</style>
