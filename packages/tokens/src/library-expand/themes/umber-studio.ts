import type { LibraryThemeDefinition } from '../../library-port/types.ts';

const definition = {
  id: 'umber-studio',
  name: 'Umber Studio',
  description: 'Umber Studio: curated earthy family theme for the expanded library.',
  category: 'earthy',
  tags: ['earthy', 'expanded', 'curated'] as const,
  collection: 'industry',
  mood: ['warm', 'editorial'] as const,
  contrastLevel: 'AA',
  seed: '#6b3800',
  secondary: '#9a3412',
  neutral: 'stone',
  radius: '0.625rem',
  density: 1,
} satisfies LibraryThemeDefinition;

export default definition;
