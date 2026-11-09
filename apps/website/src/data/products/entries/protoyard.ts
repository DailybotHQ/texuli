import type { ProductEntry } from '../schema.ts';

/** Public sources only: the npm package, the product's own docs and the ADR. */
const npm = 'https://www.npmjs.com/package/protoyard';
const docs = 'https://protoyard.app/docs';
const adr = 'docs/DECISIONS.md#adr-027-solutions-capabilities-components-and-products';

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
      source: npm,
      claim:
        'Protoyard 1.5.0 is published on npm, built on Texuli 0.14.2; its CLI covers local authoring, variant iteration, validation and prototype export.',
    },
    {
      source: docs,
      claim: 'The public engine guides for the open-source local version.',
    },
    {
      source: adr,
      claim:
        'Products built with Texuli keep their own brand and domain and use the status vocabulary; Protoyard Cloud is planned, not available.',
    },
  ],
};
