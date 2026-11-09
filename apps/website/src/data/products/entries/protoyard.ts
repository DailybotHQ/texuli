import type { ProductEntry } from '../schema.ts';

const audit =
  '.dwp/plans/PLAN_015_ecosystem_solutions_native_site/analysis_results/audit/protoyard-capabilities-current.md';
const facts =
  '.dwp/plans/PLAN_015_ecosystem_solutions_native_site/analysis_results/audit/facts.md#F-51';

export const PROTOYARD: ProductEntry = {
  id: 'protoyard',
  name: 'Protoyard',
  group: 'owner',
  visibility: 'listed',
  status: 'available',
  domain: 'protoyard.app',
  summary: 'Open-source local prototyping for exploring and validating software prototypes.',
  offerings: [
    {
      id: 'open-source-local',
      label: 'Open-source local',
      status: 'available',
      summary:
        'The current local product supports prototype authoring, iteration, validation and export.',
    },
    {
      id: 'cloud',
      label: 'Protoyard Cloud',
      status: 'planned',
      summary:
        'Cloud collaboration and AI-native interface creation are roadmap work, not available features.',
    },
  ],
  evidence: [
    {
      source: audit,
      claim:
        'The current Protoyard 1.5.0 audit verifies local authoring, variant iteration, validation and prototype export; it records Cloud as absent.',
    },
    {
      source: facts,
      claim:
        'The local open-source version may be described only from verified functionality; Protoyard Cloud must never be marked available.',
    },
  ],
};
