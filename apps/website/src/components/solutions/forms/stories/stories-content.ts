import type { SolutionStoriesProps } from '../../shared/types.ts';

export const FORMS_STORIES: Omit<SolutionStoriesProps, 'entry'> = {
  title: 'One schema, from first draft to a working form.',
  stories: [
    {
      id: 'conditions',
      title: 'Ask the next question at the right time.',
      body: 'Closed expressions control visibility and required state. Conditions read only fields already declared, so the form stays predictable and cycle-free.',
      capabilities: ['schema'],
    },
    {
      id: 'steps',
      title: 'Keep long intakes in clear steps.',
      body: 'Move through a focused step at a time. The view validates before advancing and can restore the current step with a saved draft.',
      capabilities: ['steps'],
    },
    {
      id: 'builder',
      title: 'Shape fields, then inspect the result.',
      body: 'The visual builder was released in 0.18.0 and is still in development. It edits field order and settings, validates the schema, and shows a live preview.',
      capabilities: ['builder'],
      status: 'in development',
    },
  ],
};
