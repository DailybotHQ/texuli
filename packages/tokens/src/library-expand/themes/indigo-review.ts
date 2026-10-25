import type { LibraryThemeDefinition } from '../../library-port/types.ts';

const definition = {
  id: 'indigo-review',
  name: 'Indigo Review',
  description: 'Indigo Review: curated editorial family theme for the expanded library.',
  category: 'editorial',
  tags: ['editorial', 'expanded', 'curated'] as const,
  collection: 'industry',
  mood: ['editorial', 'luxurious'] as const,
  contrastLevel: 'AA',
  seed: '#312e81',
  secondary: '#3730a3',
  neutral: 'stone',
  radius: '0.625rem',
  density: 1,
} satisfies LibraryThemeDefinition;

export default definition;
