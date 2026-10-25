import type { LibraryThemeDefinition } from '../../library-port/types.ts';

const definition = {
  id: 'bark-trail',
  name: 'Bark Trail',
  description: 'Bark Trail: curated earthy family theme for the expanded library.',
  category: 'earthy',
  tags: ['earthy', 'expanded', 'curated'] as const,
  collection: 'industry',
  mood: ['warm', 'editorial'] as const,
  contrastLevel: 'AA',
  seed: '#44403c',
  secondary: '#292524',
  neutral: 'stone',
  radius: '0.625rem',
  density: 1,
} satisfies LibraryThemeDefinition;

export default definition;
