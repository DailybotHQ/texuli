import type { LibraryThemeDefinition } from '../../library-port/types.ts';

const definition = {
  id: 'forest-op-ed',
  name: 'Forest Op-Ed',
  description: 'Forest Op-Ed: curated editorial family theme for the expanded library.',
  category: 'editorial',
  tags: ['editorial', 'expanded', 'curated'] as const,
  collection: 'industry',
  mood: ['editorial', 'luxurious'] as const,
  contrastLevel: 'AA',
  seed: '#14532d',
  secondary: '#166534',
  neutral: 'stone',
  radius: '0.625rem',
  density: 1,
} satisfies LibraryThemeDefinition;

export default definition;
