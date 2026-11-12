import type { SolutionHowProps } from '../../shared/types.ts';

export const FORMS_HOW: Omit<SolutionHowProps, 'entry'> = {
  title: 'From a closed schema to a form people can finish.',
  steps: [
    {
      title: 'Describe the fields',
      body: 'Use a closed schema with named field types, options and validation constraints.',
      package: '@texuli/forms',
    },
    {
      title: 'Validate conditions',
      body: 'Compile the schema before rendering. Invalid members, expressions and field relationships produce issues.',
      package: '@texuli/forms',
    },
    {
      title: 'Render each step',
      body: 'Mount SchemaForm with Texuli controls, accessible validation and multi-step navigation.',
      package: '@texuli/forms',
    },
    {
      title: 'Choose draft storage',
      body: 'Pass a host storage adapter for drafts and autosave. This demo keeps its sample draft in memory only.',
      package: '@texuli/forms',
    },
    {
      title: 'Build and preview',
      body: 'Use the in-development builder (not on npm yet) to arrange fields, edit settings and inspect schema JSON before adoption.',
      package: '@texuli/forms',
    },
  ],
};
