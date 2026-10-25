export type InteractiveBlockLabels = {
  invalid: string;
  pollSubmit: string;
  pollReset: string;
  pollResults: string;
  quizSubmit: string;
  quizNext: string;
  quizScore: string;
  quizCorrect: string;
  quizIncorrect: string;
  calculatorResult: string;
  checklistProgress: string;
};

export type InteractiveBlockLabelOverrides = Partial<InteractiveBlockLabels>;

export const DEFAULT_INTERACTIVE_BLOCK_LABELS: InteractiveBlockLabels = {
  invalid: 'This interactive block is not valid.',
  pollSubmit: 'Vote',
  pollReset: 'Reset',
  pollResults: 'Results',
  quizSubmit: 'Check answer',
  quizNext: 'Next question',
  quizScore: 'Score',
  quizCorrect: 'Correct',
  quizIncorrect: 'Not quite',
  calculatorResult: 'Result',
  checklistProgress: 'Completed',
};

export function resolveInteractiveBlockLabels(
  overrides?: InteractiveBlockLabelOverrides
): InteractiveBlockLabels {
  return { ...DEFAULT_INTERACTIVE_BLOCK_LABELS, ...overrides };
}
