import type { LibraryThemeDefinition } from '../../library-port/types.ts';

const definition = {
  id: 'clay-river',
  name: 'Clay River',
  description: 'Clay River: curated earthy family theme for the expanded library.',
  category: 'earthy',
  tags: ['earthy', 'expanded', 'curated'] as const,
  collection: 'industry',
  mood: ['warm', 'editorial'] as const,
  contrastLevel: 'AA',
  seed: '#af5c00',
  secondary: '#92400e',
  neutral: 'stone',
  radius: '0.625rem',
  density: 1,
} satisfies LibraryThemeDefinition;

export default definition;
