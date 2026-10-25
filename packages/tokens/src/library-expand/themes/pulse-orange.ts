import type { LibraryThemeDefinition } from '../../library-port/types.ts';

const definition = {
  id: 'pulse-orange',
  name: 'Pulse Orange',
  description: 'Pulse Orange: curated vivid family theme for the expanded library.',
  category: 'vivid',
  tags: ['vivid', 'expanded', 'curated'] as const,
  collection: 'industry',
  mood: ['bold', 'playful'] as const,
  contrastLevel: 'AA',
  seed: '#e16e00',
  secondary: '#c2410c',
  neutral: 'zinc',
  radius: '0.625rem',
  density: 1,
} satisfies LibraryThemeDefinition;

export default definition;
