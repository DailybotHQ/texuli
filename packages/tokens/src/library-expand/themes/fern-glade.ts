import type { LibraryThemeDefinition } from '../../library-port/types.ts';

const definition = {
  id: 'fern-glade',
  name: 'Fern Glade',
  description: 'Fern Glade: curated earthy family theme for the expanded library.',
  category: 'earthy',
  tags: ['earthy', 'expanded', 'curated'] as const,
  collection: 'industry',
  mood: ['warm', 'editorial'] as const,
  contrastLevel: 'AA',
  seed: '#15803d',
  secondary: '#166534',
  neutral: 'stone',
  radius: '0.625rem',
  density: 1,
} satisfies LibraryThemeDefinition;

export default definition;
