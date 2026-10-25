import type { LibraryThemeDefinition } from '../../library-port/types.ts';

const definition = {
  id: 'ivory-press',
  name: 'Ivory Press',
  description: 'Ivory Press: curated editorial family theme for the expanded library.',
  category: 'editorial',
  tags: ['editorial', 'expanded', 'curated'] as const,
  collection: 'industry',
  mood: ['editorial', 'luxurious'] as const,
  contrastLevel: 'AA',
  seed: '#78716c',
  secondary: '#57534e',
  neutral: 'stone',
  radius: '0.625rem',
  density: 1,
} satisfies LibraryThemeDefinition;

export default definition;
