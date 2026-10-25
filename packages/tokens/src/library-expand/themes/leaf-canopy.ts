import type { LibraryThemeDefinition } from '../../library-port/types.ts';

const definition = {
  id: 'leaf-canopy',
  name: 'Leaf Canopy',
  description: 'Leaf Canopy: curated earthy family theme for the expanded library.',
  category: 'earthy',
  tags: ['earthy', 'expanded', 'curated'] as const,
  collection: 'industry',
  mood: ['warm', 'editorial'] as const,
  contrastLevel: 'AA',
  seed: '#16a34a',
  secondary: '#15803d',
  neutral: 'stone',
  radius: '0.625rem',
  density: 1,
} satisfies LibraryThemeDefinition;

export default definition;
