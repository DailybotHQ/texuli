import type { LibraryThemeDefinition } from '../../library-port/types.ts';

const definition = {
  id: 'gold-serif',
  name: 'Gold Serif',
  description: 'Gold Serif: curated editorial family theme for the expanded library.',
  category: 'editorial',
  tags: ['editorial', 'expanded', 'curated'] as const,
  collection: 'industry',
  mood: ['editorial', 'luxurious'] as const,
  contrastLevel: 'AA',
  seed: '#906500',
  secondary: '#854d0e',
  neutral: 'stone',
  radius: '0.625rem',
  density: 1,
} satisfies LibraryThemeDefinition;

export default definition;
