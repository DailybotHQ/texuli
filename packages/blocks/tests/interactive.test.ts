import { cleanup, fireEvent, render } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import { safeParseBlock } from '../src/core/index.ts';
import { checkInteractiveBlock } from '../src/interactive/check.ts';
import InteractiveBlockView from '../src/interactive/InteractiveBlockView.svelte';
import { evaluateCalculator } from '../src/interactive/schema.ts';

afterEach(() => cleanup());

const poll = {
  type: 'poll',
  id: 'q1',
  question: 'Which fictional harbor is busiest?',
  options: [
    { id: 'north', label: 'North Pier' },
    { id: 'south', label: 'South Basin' },
  ],
};

const quiz = {
  type: 'quiz',
  title: 'Harbor basics',
  questions: [
    {
      id: 'q1',
      prompt: 'What color is the fictional beacon?',
      options: [
        { id: 'red', label: 'Red' },
        { id: 'blue', label: 'Blue' },
      ],
      correctId: 'red',
      explanation: 'The beacon is red in the story.',
    },
  ],
};

const calculator = {
  type: 'calculator',
  title: 'Trip cost',
  inputs: [
    { name: 'hours', label: 'Hours', default: 2, min: 0 },
    { name: 'rate', label: 'Rate (cents/hour)', default: 1500, min: 0 },
  ],
  formula: {
    op: 'mul',
    left: { op: 'var', name: 'hours' },
    right: { op: 'var', name: 'rate' },
  },
  unit: 'cents',
  outputLabel: 'Total',
};

const checklist = {
  type: 'checklist',
  title: 'Launch checklist',
  items: [
    { id: 'fuel', label: 'Check fuel' },
    { id: 'lines', label: 'Secure lines', done: true },
  ],
};

describe('interactive block schema', () => {
  it('accepts poll, quiz, calculator and checklist; rejects hostile or incomplete interactive data; evaluates calculator formulas from validated data', async () => {
    // accepts poll, quiz, calculator and checklist
    for (const block of [poll, quiz, calculator, checklist]) {
      const parsed = safeParseBlock(block);
      expect(parsed.success).toBe(true);
      expect(checkInteractiveBlock(block).ok).toBe(true);
    }
    cleanup();
    // rejects hostile or incomplete interactive data
    expect(
      safeParseBlock({
        type: 'poll',
        question: 'Hi',
        options: [{ id: 'a', label: 'Only one' }],
      }).success
    ).toBe(false);

    expect(
      safeParseBlock({
        type: 'poll',
        question: 'Hi\u202E',
        options: [
          { id: 'a', label: 'A' },
          { id: 'b', label: 'B' },
        ],
      }).success
    ).toBe(false);

    expect(
      safeParseBlock({
        type: 'quiz',
        questions: [
          {
            id: 'q1',
            prompt: 'Q',
            options: [
              { id: 'a', label: 'A' },
              { id: 'b', label: 'B' },
            ],
            correctId: 'missing',
          },
        ],
      }).success
    ).toBe(false);

    expect(
      safeParseBlock({
        type: 'calculator',
        inputs: [{ name: 'x', label: 'X', default: 1 }],
        formula: { op: 'var', name: 'y' },
      }).success
    ).toBe(false);

    expect(
      safeParseBlock({
        type: 'checklist',
        items: [{ id: '1bad', label: 'Nope' }],
      }).success
    ).toBe(false);
    cleanup();
    // evaluates calculator formulas from validated data
    await (async () => {
      const parsed = safeParseBlock(calculator);
      expect(parsed.success).toBe(true);
      if (!parsed.success || parsed.data.type !== 'calculator') return;
      const result = evaluateCalculator(parsed.data, { hours: 2, rate: 1500 });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value).toBe(3000);
      expect(result.formatted).toMatch(/\$/);
    })();
  });
});

describe('InteractiveBlockView', () => {
  it('renders a poll and accepts a vote; renders checklist progress; shows invalid note for hostile blocks', async () => {
    // renders a poll and accepts a vote
    await (async () => {
      const { getByText, getByRole } = render(InteractiveBlockView, {
        props: { block: poll },
      });
      expect(getByText(/busiest/)).toBeTruthy();
      // select first option via radio
      const radios = document.querySelectorAll('[role="radio"]');
      expect(radios.length).toBeGreaterThan(0);
      await fireEvent.click(radios[0]!);
      await fireEvent.click(getByRole('button', { name: 'Vote' }));
      expect(getByText('Results')).toBeTruthy();
    })();
    cleanup();
    // renders checklist progress
    await (async () => {
      const { getByText } = render(InteractiveBlockView, {
        props: { block: checklist },
      });
      expect(getByText(/Completed:\s*1\s*\/\s*2/)).toBeTruthy();
    })();
    cleanup();
    {
      // shows invalid note for hostile blocks
      const { getByRole } = render(InteractiveBlockView, {
        props: {
          block: {
            type: 'poll',
            question: 'x',
            options: [{ id: 'a', label: 'A' }],
          },
        },
      });
      expect(getByRole('note').textContent).toMatch(/not valid/i);
    }
  });
});
