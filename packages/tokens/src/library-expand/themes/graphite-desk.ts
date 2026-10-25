import type { LibraryThemeDefinition } from '../../library-port/types.ts';

const definition = {
  id: 'graphite-desk',
  name: 'Graphite Desk',
  description: 'Graphite Desk: curated neutral family theme for the expanded library.',
  category: 'neutral',
  tags: ['neutral', 'expanded', 'curated'] as const,
  collection: 'mono',
  mood: ['minimal'] as const,
  contrastLevel: 'AA',
  seed: '#3d3a52',
  secondary: '#27272a',
  neutral: 'zinc',
  radius: '0.625rem',
  density: 1,
} satisfies LibraryThemeDefinition;

export default definition;
