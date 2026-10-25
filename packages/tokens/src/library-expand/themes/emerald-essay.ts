import type { LibraryThemeDefinition } from '../../library-port/types.ts';

const definition = {
  id: 'emerald-essay',
  name: 'Emerald Essay',
  description: 'Emerald Essay: curated editorial family theme for the expanded library.',
  category: 'editorial',
  tags: ['editorial', 'expanded', 'curated'] as const,
  collection: 'industry',
  mood: ['editorial', 'luxurious'] as const,
  contrastLevel: 'AA',
  seed: '#065f46',
  secondary: '#047857',
  neutral: 'stone',
  radius: '0.625rem',
  density: 1,
} satisfies LibraryThemeDefinition;

export default definition;
