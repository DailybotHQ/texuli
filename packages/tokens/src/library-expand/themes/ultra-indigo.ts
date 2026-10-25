import type { LibraryThemeDefinition } from '../../library-port/types.ts';

const definition = {
  id: 'ultra-indigo',
  name: 'Ultra Indigo',
  description: 'Ultra Indigo: curated vivid family theme for the expanded library.',
  category: 'vivid',
  tags: ['vivid', 'expanded', 'curated'] as const,
  collection: 'industry',
  mood: ['bold', 'playful'] as const,
  contrastLevel: 'AA',
  seed: '#6b45df',
  secondary: '#4338ca',
  neutral: 'zinc',
  radius: '0.625rem',
  density: 1,
} satisfies LibraryThemeDefinition;

export default definition;
