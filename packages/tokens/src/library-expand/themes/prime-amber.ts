import type { LibraryThemeDefinition } from '../../library-port/types.ts';

const definition = {
  id: 'prime-amber',
  name: 'Prime Amber',
  description: 'Prime Amber: curated brand-like family theme for the expanded library.',
  category: 'brand-like',
  tags: ['brand-like', 'expanded', 'curated'] as const,
  collection: 'brand-like',
  mood: ['corporate', 'bold'] as const,
  contrastLevel: 'AA',
  seed: '#887500',
  secondary: '#92400e',
  neutral: 'slate',
  radius: '0.625rem',
  density: 1,
} satisfies LibraryThemeDefinition;

export default definition;
