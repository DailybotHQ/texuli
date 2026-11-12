import type { SolutionEntry } from '../schema.ts';

/** Forms: schema-driven forms (ADR-036). @texuli/forms is in development. */
export const forms: SolutionEntry = {
  slug: 'forms',
  name: 'Forms',
  status: 'in development',
  tagline: 'Schema-driven forms with conditions, steps and drafts.',
  summary:
    'A closed form schema rendered with Texuli components, multi-step flows, conditional logic, announced validation, drafts and autosave. The visual builder the landing needs is still landing.',
  route: '/solutions/forms/',
  docs: '/guides/solutions/forms/',
  packages: [
    {
      name: '@texuli/forms',
      subpaths: ['.', './model', './controls', './host'],
      role: 'Schema, model, controls and host rendering — in development on npm',
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
      summary: 'Author a schema on a canvas. Planned for this Solution; not shipped yet.',
      status: 'planned',
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
    scenarios: ['intake'],
    limits: ['Placeholder until the Forms landing demo ships. Nothing is saved.'],
  },
  art: { hero: { slot: 'solution-forms-hero', variant: 'plate' } },
  limits: [
    '@texuli/forms is in development (pre-1.0): a new minor version may break the API.',
    'The visual form builder is planned, not shipped.',
    '/forms-page/ stays as the capability reference; it is not redirected (ADR-036).',
  ],
  links: [
    { label: 'Read the docs', href: '/guides/solutions/forms/' },
    { label: 'Capability page (reference)', href: '/forms-page/' },
    { label: '@texuli/forms on npm', href: 'https://www.npmjs.com/package/@texuli/forms' },
  ],
};
