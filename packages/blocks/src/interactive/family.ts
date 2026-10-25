import type { Component } from 'svelte';
import type { InteractiveBlockViewProps } from './engine.ts';

export {
  type CalculatorBlock,
  type ChecklistBlock,
  INTERACTIVE_BLOCK_TYPES,
  type InteractiveBlock,
  type InteractiveBlockType,
  type InteractiveBlockViewProps,
  type InteractiveFamilyBlock,
  type InteractiveFamilyBlockType,
  isInteractiveFamilyBlock,
  type PollBlock,
  type QuizBlock,
} from './engine.ts';

export function loadInteractiveFamily(): Promise<{
  default: Component<InteractiveBlockViewProps>;
}> {
  return import('./InteractiveBlockView.svelte');
}
