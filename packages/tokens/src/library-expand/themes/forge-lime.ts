import type { LibraryThemeDefinition } from '../../library-port/types.ts';

const definition = {
  id: 'forge-lime',
  name: 'Forge Lime',
  description: 'Forge Lime: curated brand-like family theme for the expanded library.',
  category: 'brand-like',
  tags: ['brand-like', 'expanded', 'curated'] as const,
  collection: 'brand-like',
  mood: ['corporate', 'bold'] as const,
  contrastLevel: 'AA',
  seed: '#4d7c0f',
  secondary: '#3f6212',
  neutral: 'slate',
  radius: '0.625rem',
  density: 1,
} satisfies LibraryThemeDefinition;

export default definition;
