import type { ProductEntry } from '../schema.ts';

/** Public sources only. No public page describes Ronin Builder yet; the ADR sets the rules. */
const adr = 'docs/DECISIONS.md#adr-027-solutions-capabilities-components-and-products';

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
      source: adr,
      claim:
        'Every product entry carries a status from the vocabulary; Ronin Builder is a planned concept, unlisted and never shown as available.',
    },
  ],
};
