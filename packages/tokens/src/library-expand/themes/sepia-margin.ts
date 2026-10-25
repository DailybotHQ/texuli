import type { LibraryThemeDefinition } from '../../library-port/types.ts';

const definition = {
  id: 'sepia-margin',
  name: 'Sepia Margin',
  description: 'Sepia Margin: curated editorial family theme for the expanded library.',
  category: 'editorial',
  tags: ['editorial', 'expanded', 'curated'] as const,
  collection: 'industry',
  mood: ['editorial', 'luxurious'] as const,
  contrastLevel: 'AA',
  seed: '#78350f',
  secondary: '#92400e',
  neutral: 'stone',
  radius: '0.625rem',
  density: 1,
} satisfies LibraryThemeDefinition;

export default definition;
