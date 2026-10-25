import type { LibraryThemeDefinition } from '../../library-port/types.ts';

const definition = {
  id: 'wheat-barn',
  name: 'Wheat Barn',
  description: 'Wheat Barn: curated earthy family theme for the expanded library.',
  category: 'earthy',
  tags: ['earthy', 'expanded', 'curated'] as const,
  collection: 'industry',
  mood: ['warm', 'editorial'] as const,
  contrastLevel: 'AA',
  seed: '#737d14',
  secondary: '#ca8a04',
  neutral: 'stone',
  radius: '0.625rem',
  density: 1,
} satisfies LibraryThemeDefinition;

export default definition;
