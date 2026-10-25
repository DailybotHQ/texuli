import type { LibraryThemeDefinition } from '../../library-port/types.ts';

const definition = {
  id: 'burgundy-page',
  name: 'Burgundy Page',
  description: 'Burgundy Page: curated editorial family theme for the expanded library.',
  category: 'editorial',
  tags: ['editorial', 'expanded', 'curated'] as const,
  collection: 'industry',
  mood: ['editorial', 'luxurious'] as const,
  contrastLevel: 'AA',
  seed: '#881337',
  secondary: '#9f1239',
  neutral: 'stone',
  radius: '0.625rem',
  density: 1,
} satisfies LibraryThemeDefinition;

export default definition;
