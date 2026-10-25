import type { LibraryThemeDefinition } from '../../library-port/types.ts';

const definition = {
  id: 'vector-sky',
  name: 'Vector Sky',
  description: 'Vector Sky: curated brand-like family theme for the expanded library.',
  category: 'brand-like',
  tags: ['brand-like', 'expanded', 'curated'] as const,
  collection: 'brand-like',
  mood: ['corporate', 'bold'] as const,
  contrastLevel: 'AA',
  seed: '#3069aa',
  secondary: '#075985',
  neutral: 'slate',
  radius: '0.625rem',
  density: 1,
} satisfies LibraryThemeDefinition;

export default definition;
