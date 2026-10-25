import type { LibraryThemeDefinition } from '../../library-port/types.ts';

const definition = {
  id: 'loam-field',
  name: 'Loam Field',
  description: 'Loam Field: curated earthy family theme for the expanded library.',
  category: 'earthy',
  tags: ['earthy', 'expanded', 'curated'] as const,
  collection: 'industry',
  mood: ['warm', 'editorial'] as const,
  contrastLevel: 'AA',
  seed: '#8f4300',
  secondary: '#78350f',
  neutral: 'stone',
  radius: '0.625rem',
  density: 1,
} satisfies LibraryThemeDefinition;

export default definition;
