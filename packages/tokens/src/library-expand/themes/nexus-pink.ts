import type { LibraryThemeDefinition } from '../../library-port/types.ts';

const definition = {
  id: 'nexus-pink',
  name: 'Nexus Pink',
  description: 'Nexus Pink: curated brand-like family theme for the expanded library.',
  category: 'brand-like',
  tags: ['brand-like', 'expanded', 'curated'] as const,
  collection: 'brand-like',
  mood: ['corporate', 'bold'] as const,
  contrastLevel: 'AA',
  seed: '#be185d',
  secondary: '#9d174d',
  neutral: 'slate',
  radius: '0.625rem',
  density: 1,
} satisfies LibraryThemeDefinition;

export default definition;
