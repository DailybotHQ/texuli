import type { LibraryThemeDefinition } from '../../library-port/types.ts';

const definition = {
  id: 'beacon-red',
  name: 'Beacon Red',
  description: 'Beacon Red: curated brand-like family theme for the expanded library.',
  category: 'brand-like',
  tags: ['brand-like', 'expanded', 'curated'] as const,
  collection: 'brand-like',
  mood: ['corporate', 'bold'] as const,
  contrastLevel: 'AA',
  seed: '#b91c1c',
  secondary: '#991b1b',
  neutral: 'slate',
  radius: '0.625rem',
  density: 1,
} satisfies LibraryThemeDefinition;

export default definition;
