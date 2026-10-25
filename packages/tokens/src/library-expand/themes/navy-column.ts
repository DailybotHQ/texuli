import type { LibraryThemeDefinition } from '../../library-port/types.ts';

const definition = {
  id: 'navy-column',
  name: 'Navy Column',
  description: 'Navy Column: curated editorial family theme for the expanded library.',
  category: 'editorial',
  tags: ['editorial', 'expanded', 'curated'] as const,
  collection: 'industry',
  mood: ['editorial', 'luxurious'] as const,
  contrastLevel: 'AA',
  seed: '#30388c',
  secondary: '#1e40af',
  neutral: 'stone',
  radius: '0.625rem',
  density: 1,
} satisfies LibraryThemeDefinition;

export default definition;
