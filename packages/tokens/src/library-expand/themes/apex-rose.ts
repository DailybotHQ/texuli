import type { LibraryThemeDefinition } from '../../library-port/types.ts';

const definition = {
  id: 'apex-rose',
  name: 'Apex Rose',
  description: 'Apex Rose: curated brand-like family theme for the expanded library.',
  category: 'brand-like',
  tags: ['brand-like', 'expanded', 'curated'] as const,
  collection: 'brand-like',
  mood: ['corporate', 'bold'] as const,
  contrastLevel: 'AA',
  seed: '#c21b27',
  secondary: '#9f1239',
  neutral: 'slate',
  radius: '0.625rem',
  density: 1,
} satisfies LibraryThemeDefinition;

export default definition;
