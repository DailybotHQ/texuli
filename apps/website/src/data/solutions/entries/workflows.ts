import type { SolutionEntry } from '../schema.ts';

/** Workflows: graph authoring and viewing, not a workflow runtime (facts F-26). */
export const workflows: SolutionEntry = {
  slug: 'workflows',
  name: 'Workflows',
  status: 'in development',
  tagline: 'Author and view workflow graphs inside your app.',
  summary:
    'A typed graph model that validates operations, ports and cycles, with deterministic layout, history, an editor, an inspector, an accessible outline and a read-only viewer.',
  route: '/solutions/workflows/',
  docs: '/guides/solutions/workflows/',
  replaces: '/workflows-page/',
  packages: [
    {
      name: '@texuli/workflows',
      subpaths: ['./model', './layout', './editor', './viewer', './inspector'],
      role: 'Graph model, layout, editor, viewer and inspector',
    },
  ],
  capabilities: [
    {
      id: 'graph-model',
      title: 'Graph model',
      summary: 'Validate nodes, ports, edges and cycle policy as data.',
      status: 'in development',
    },
    {
      id: 'layout',
      title: 'Layout',
      summary: 'Place nodes with a deterministic layout.',
      status: 'in development',
    },
    {
      id: 'author',
      title: 'Author',
      summary: 'Edit a graph with history and an inspector.',
      status: 'in development',
    },
    {
      id: 'view',
      title: 'View',
      summary: 'Show a graph read-only, with an accessible outline.',
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
    id: 'workflows',
    title: 'Edit an approval flow',
    scenarios: ['expense-approval'],
    limits: ['Runs in the browser on one fixture graph; nothing runs or is saved.'],
  },
  art: { hero: { slot: 'solution-workflows-hero', variant: 'plate' } },
  limits: [
    'Pre-1.0 and in development: a new minor version may break the API.',
    'Texuli draws and edits the graph; it does not run workflows.',
    'No hosted persistence; the host app stores the graph.',
  ],
  links: [
    { label: 'Read the docs', href: '/guides/solutions/workflows/' },
    { label: 'JSON blueprint preview', href: '/workflows-page/json/' },
    { label: '@texuli/workflows on npm', href: 'https://www.npmjs.com/package/@texuli/workflows' },
  ],
};
