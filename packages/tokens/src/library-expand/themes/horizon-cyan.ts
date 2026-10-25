import type { LibraryThemeDefinition } from '../../library-port/types.ts';

const definition = {
  id: 'horizon-cyan',
  name: 'Horizon Cyan',
  description: 'Horizon Cyan: curated brand-like family theme for the expanded library.',
  category: 'brand-like',
  tags: ['brand-like', 'expanded', 'curated'] as const,
  collection: 'brand-like',
  mood: ['corporate', 'bold'] as const,
  contrastLevel: 'AA',
  seed: '#2a769b',
  secondary: '#155e75',
  neutral: 'slate',
  radius: '0.625rem',
  density: 1,
} satisfies LibraryThemeDefinition;

export default definition;
