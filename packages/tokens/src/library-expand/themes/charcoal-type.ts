import type { LibraryThemeDefinition } from '../../library-port/types.ts';

const definition = {
  id: 'charcoal-type',
  name: 'Charcoal Type',
  description: 'Charcoal Type: curated editorial family theme for the expanded library.',
  category: 'editorial',
  tags: ['editorial', 'expanded', 'curated'] as const,
  collection: 'industry',
  mood: ['editorial', 'luxurious'] as const,
  contrastLevel: 'AA',
  seed: '#292524',
  secondary: '#1c1917',
  neutral: 'stone',
  radius: '0.625rem',
  density: 1,
} satisfies LibraryThemeDefinition;

export default definition;
