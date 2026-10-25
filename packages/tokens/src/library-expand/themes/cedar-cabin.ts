import type { LibraryThemeDefinition } from '../../library-port/types.ts';

const definition = {
  id: 'cedar-cabin',
  name: 'Cedar Cabin',
  description: 'Cedar Cabin: curated earthy family theme for the expanded library.',
  category: 'earthy',
  tags: ['earthy', 'expanded', 'curated'] as const,
  collection: 'industry',
  mood: ['warm', 'editorial'] as const,
  contrastLevel: 'AA',
  seed: '#9a3412',
  secondary: '#7c2d12',
  neutral: 'stone',
  radius: '0.625rem',
  density: 1,
} satisfies LibraryThemeDefinition;

export default definition;
