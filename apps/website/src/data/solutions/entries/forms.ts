import type { SolutionEntry } from '../schema.ts';

/** Forms: schema-driven forms (ADR-036). @texuli/forms is in development. */
export const forms: SolutionEntry = {
  slug: 'forms',
  name: 'Forms',
  status: 'in development',
  tagline: 'Schema-driven forms with conditions, steps and drafts.',
  summary:
    'A closed form schema rendered with Texuli components, multi-step flows, conditional logic, announced validation, drafts and autosave. The visual builder subpath is in development: added after 0.17.4, not on npm yet, planned for the next release.',
  route: '/solutions/forms/',
  docs: '/guides/solutions/forms/',
  packages: [
    {
      name: '@texuli/forms',
      subpaths: ['.', './model', './controls', './builder', './host'],
      role: 'Schema, model, controls and host rendering are in development and published on npm; the builder (added after 0.17.4) is not on npm yet.',
    },
  ],
  capabilities: [
    {
      id: 'schema',
      title: 'Schema forms',
      summary: 'Render a closed form schema with Texuli fields and announced validation.',
      status: 'in development',
    },
    {
      id: 'steps',
      title: 'Steps and conditions',
      summary: 'Multi-step flows and conditional logic on @texuli/core/expression.',
      status: 'in development',
    },
    {
      id: 'drafts',
      title: 'Drafts',
      summary: 'Keep a draft and autosave it. Persistence belongs to the host.',
      status: 'in development',
    },
    {
      id: 'builder',
      title: 'Visual builder',
      summary:
        'Author and reorder fields, edit settings, preview the form and inspect schema JSON. In development; planned for the next release.',
      status: 'in development',
    },
  ],
  platforms: [
    { platform: 'web', status: 'in development', evidence: [] },
    { platform: 'compose-desktop', status: 'planned', evidence: [] },
    { platform: 'android', status: 'planned', evidence: [] },
    { platform: 'ios', status: 'planned', evidence: [] },
  ],
  demo: {
    id: 'forms',
    title: 'Fill a multi-step intake',
    scenarios: ['intake', 'builder'],
    limits: [
      'The intake draft stays in this page session and nothing is submitted.',
      'The visual builder subpath is in development: added after 0.17.4, not on npm yet, planned for the next release.',
    ],
  },
  art: { hero: { slot: 'solution-forms-hero', variant: 'plate' } },
  limits: [
    '@texuli/forms is in development (pre-1.0): a new minor version may break the API.',
    'The visual builder subpath is in development: added after 0.17.4, not on npm yet, planned for the next release.',
    '/forms-page/ stays as the capability reference; it is not redirected (ADR-036).',
  ],
  links: [
    { label: 'Read the docs', href: '/guides/solutions/forms/' },
    { label: 'Capability page (reference)', href: '/forms-page/' },
    { label: '@texuli/forms on npm', href: 'https://www.npmjs.com/package/@texuli/forms' },
  ],
};
