import type { LibraryThemeDefinition } from '../../library-port/types.ts';

const definition = {
  id: 'pine-ridge',
  name: 'Pine Ridge',
  description: 'Pine Ridge: curated earthy family theme for the expanded library.',
  category: 'earthy',
  tags: ['earthy', 'expanded', 'curated'] as const,
  collection: 'industry',
  mood: ['warm', 'editorial'] as const,
  contrastLevel: 'AA',
  seed: '#00583c',
  secondary: '#052e16',
  neutral: 'stone',
  radius: '0.625rem',
  density: 1,
} satisfies LibraryThemeDefinition;

export default definition;
