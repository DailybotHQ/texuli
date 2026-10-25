import type { LibraryThemeDefinition } from '../../library-port/types.ts';

const definition = {
  id: 'crimson-spread',
  name: 'Crimson Spread',
  description: 'Crimson Spread: curated editorial family theme for the expanded library.',
  category: 'editorial',
  tags: ['editorial', 'expanded', 'curated'] as const,
  collection: 'industry',
  mood: ['editorial', 'luxurious'] as const,
  contrastLevel: 'AA',
  seed: '#a31829',
  secondary: '#881337',
  neutral: 'stone',
  radius: '0.625rem',
  density: 1,
} satisfies LibraryThemeDefinition;

export default definition;
