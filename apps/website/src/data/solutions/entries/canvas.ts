import type { SolutionEntry } from '../schema.ts';

/** Canvas: an embeddable whiteboard with local collaboration (facts F-27). */
export const canvas: SolutionEntry = {
  slug: 'canvas',
  name: 'Canvas',
  status: 'in development',
  tagline: 'An embeddable whiteboard with shapes, connectors and export.',
  summary:
    'A canvas model, editor and viewer for shapes, text, connectors, grouping and transforms, with undo, validation, keyboard navigation, document sync and SVG or PNG export.',
  route: '/solutions/canvas/',
  docs: '/guides/solutions/canvas/',
  replaces: '/canvas-page/',
  packages: [
    {
      name: '@texuli/canvas',
      subpaths: ['./model', './editor', './viewer', './sync', './export'],
      role: 'Canvas model, editor, viewer, sync and export',
    },
  ],
  capabilities: [
    {
      id: 'draw',
      title: 'Draw',
      summary: 'Place shapes, text and connectors, then group and transform them.',
      status: 'in development',
    },
    {
      id: 'keyboard',
      title: 'Keyboard and tree navigation',
      summary: 'Move through the canvas with the keyboard and an accessible tree.',
      status: 'in development',
    },
    {
      id: 'sync',
      title: 'Local collaboration',
      summary: 'Keep replicas in step through the document sync adapter.',
      status: 'in development',
    },
    {
      id: 'export',
      title: 'Export',
      summary: 'Export a canvas as SVG or PNG.',
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
    id: 'canvas',
    title: 'Sketch a launch plan',
    scenarios: ['launch-plan'],
    limits: ['Runs in the browser on one fixture board; nothing is saved.'],
  },
  art: { hero: { slot: 'solution-canvas-hero', variant: 'plate' } },
  limits: [
    'Pre-1.0 and in development: a new minor version may break the API.',
    'Collaboration is local or in memory, not a hosted realtime service.',
    'Persistence, transport and image hosting belong to the host app.',
  ],
  links: [
    { label: 'Read the docs', href: '/guides/solutions/canvas/' },
    { label: '@texuli/canvas on npm', href: 'https://www.npmjs.com/package/@texuli/canvas' },
  ],
};
