import { SOLUTION_SECTION_IDS } from '../../shared/subnav/sections.ts';
import type { SolutionHeroProps } from '../../shared/types.ts';

export const FORMS_HERO: Omit<SolutionHeroProps, 'entry'> = {
  eyebrow: 'Solution · Forms',
  title: 'Forms shaped by a schema. Ready for real workflows.',
  lede: 'Build a multi-step intake, reveal fields when they matter, and keep drafts with storage your app controls. Explore the in-development builder and preview the form beside it.',
  ctas: [
    { kind: 'primary', label: 'Try the forms demo', href: `#${SOLUTION_SECTION_IDS.demo}` },
    {
      kind: 'secondary',
      label: 'Start with the schema',
      href: `#${SOLUTION_SECTION_IDS.quickstart}`,
    },
  ],
};
