import type {
  SolutionAgentsProps,
  SolutionNextStepsProps,
  SolutionPlatformsProps,
  SolutionRecipesProps,
} from '../../shared/types.ts';

export const FORMS_RECIPES: Omit<SolutionRecipesProps, 'entry'> = {
  title: 'Keep building',
  recipes: [
    {
      title: 'Render a validated schema',
      summary: 'Start with a closed schema and mount SchemaForm from the forms package.',
      href: '/guides/solutions/forms/',
    },
    {
      title: 'Explore every field control',
      summary: 'Browse the package example for supported form field types.',
      href: '/examples/forms-fields/',
    },
  ],
};

export const FORMS_AGENTS: Omit<SolutionAgentsProps, 'entry'> = {
  title: 'For agents',
  body: 'A host can validate a schema before rendering it. The builder is a developer-facing authoring tool; it does not execute generated code or send form submissions.',
  surfaces: [
    {
      label: '@texuli/forms/model',
      detail:
        'Closed form schema validation and controller logic, available in the in-development package.',
      status: 'in development',
    },
    {
      label: '@texuli/forms/builder',
      detail:
        'Visual field authoring and preview; present in this branch and planned for the next release.',
      status: 'planned',
    },
  ],
};

export const FORMS_PLATFORMS: Omit<SolutionPlatformsProps, 'entry'> = {
  title: 'Platforms',
};

export const FORMS_NEXT: Omit<SolutionNextStepsProps, 'entry'> = {
  links: [
    { label: 'Build a schema form', href: '/guides/solutions/forms/' },
    { label: 'Forms capability reference', href: '/forms-page/' },
    { label: '@texuli/forms on npm', href: 'https://www.npmjs.com/package/@texuli/forms' },
  ],
};
