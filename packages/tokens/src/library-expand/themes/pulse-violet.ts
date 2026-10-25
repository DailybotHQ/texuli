import type { LibraryThemeDefinition } from '../../library-port/types.ts';

const definition = {
  id: 'pulse-violet',
  name: 'Pulse Violet',
  description: 'Pulse Violet: curated brand-like family theme for the expanded library.',
  category: 'brand-like',
  tags: ['brand-like', 'expanded', 'curated'] as const,
  collection: 'brand-like',
  mood: ['corporate', 'bold'] as const,
  contrastLevel: 'AA',
  seed: '#6d2ec9',
  secondary: '#5b21b6',
  neutral: 'slate',
  radius: '0.625rem',
  density: 1,
} satisfies LibraryThemeDefinition;

export default definition;
