import type { ProductEntry } from '../schema.ts';

const audit =
  '.dwp/plans/PLAN_015_ecosystem_solutions_native_site/analysis_results/audit/protoyard-capabilities-current.md';
const vision =
  '.dwp/plans/PLAN_015_ecosystem_solutions_native_site/analysis_results/SOURCE_SUPERPROMPT_2_2.md#18.3';
const facts =
  '.dwp/plans/PLAN_015_ecosystem_solutions_native_site/analysis_results/audit/facts.md#F-51';

export const RONIN_BUILDER: ProductEntry = {
  id: 'ronin-builder',
  name: 'Ronin Builder',
  group: 'owner',
  visibility: 'unlisted',
  status: 'planned',
  domain: null,
  summary: 'A planned concept for discovering and customizing templates for real experiences.',
  offerings: [
    {
      id: 'template-marketplace',
      label: 'Template marketplace',
      status: 'planned',
      summary:
        'The concept is a marketplace for discovering, distributing and customizing templates.',
    },
  ],
  evidence: [
    {
      source: audit,
      claim: 'Ronin Builder is absent from the current Protoyard consumer checkout.',
    },
    {
      source: vision,
      claim: 'Ronin Builder is described as a concept, not as an available product.',
    },
    {
      source: facts,
      claim: 'Ronin Builder must never be shown as available on texuli.com.',
    },
  ],
};
