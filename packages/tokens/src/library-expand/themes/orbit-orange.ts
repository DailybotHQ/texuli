import type { LibraryThemeDefinition } from '../../library-port/types.ts';

const definition = {
  id: 'orbit-orange',
  name: 'Orbit Orange',
  description: 'Orbit Orange: curated brand-like family theme for the expanded library.',
  category: 'brand-like',
  tags: ['brand-like', 'expanded', 'curated'] as const,
  collection: 'brand-like',
  mood: ['corporate', 'bold'] as const,
  contrastLevel: 'AA',
  seed: '#bc4a00',
  secondary: '#9a3412',
  neutral: 'slate',
  radius: '0.625rem',
  density: 1,
} satisfies LibraryThemeDefinition;

export default definition;
