import type { LibraryThemeDefinition } from '../../library-port/types.ts';

const definition = {
  id: 'copper-byline',
  name: 'Copper Byline',
  description: 'Copper Byline: curated editorial family theme for the expanded library.',
  category: 'editorial',
  tags: ['editorial', 'expanded', 'curated'] as const,
  collection: 'industry',
  mood: ['editorial', 'luxurious'] as const,
  contrastLevel: 'AA',
  seed: '#983d00',
  secondary: '#c2410c',
  neutral: 'stone',
  radius: '0.625rem',
  density: 1,
} satisfies LibraryThemeDefinition;

export default definition;
