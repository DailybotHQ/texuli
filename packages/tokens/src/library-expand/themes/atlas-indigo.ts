import type { LibraryThemeDefinition } from '../../library-port/types.ts';

const definition = {
  id: 'atlas-indigo',
  name: 'Atlas Indigo',
  description: 'Atlas Indigo: curated brand-like family theme for the expanded library.',
  category: 'brand-like',
  tags: ['brand-like', 'expanded', 'curated'] as const,
  collection: 'brand-like',
  mood: ['corporate', 'bold'] as const,
  contrastLevel: 'AA',
  seed: '#4338ca',
  secondary: '#3730a3',
  neutral: 'slate',
  radius: '0.625rem',
  density: 1,
} satisfies LibraryThemeDefinition;

export default definition;
