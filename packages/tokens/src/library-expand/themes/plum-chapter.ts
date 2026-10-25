import type { LibraryThemeDefinition } from '../../library-port/types.ts';

const definition = {
  id: 'plum-chapter',
  name: 'Plum Chapter',
  description: 'Plum Chapter: curated editorial family theme for the expanded library.',
  category: 'editorial',
  tags: ['editorial', 'expanded', 'curated'] as const,
  collection: 'industry',
  mood: ['editorial', 'luxurious'] as const,
  contrastLevel: 'AA',
  seed: '#6b21a8',
  secondary: '#581c87',
  neutral: 'stone',
  radius: '0.625rem',
  density: 1,
} satisfies LibraryThemeDefinition;

export default definition;
