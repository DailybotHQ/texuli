import type { LibraryThemeDefinition } from '../../library-port/types.ts';

const definition = {
  id: 'olive-grove',
  name: 'Olive Grove',
  description: 'Olive Grove: curated earthy family theme for the expanded library.',
  category: 'earthy',
  tags: ['earthy', 'expanded', 'curated'] as const,
  collection: 'industry',
  mood: ['warm', 'editorial'] as const,
  contrastLevel: 'AA',
  seed: '#008360',
  secondary: '#3f6212',
  neutral: 'stone',
  radius: '0.625rem',
  density: 1,
} satisfies LibraryThemeDefinition;

export default definition;
