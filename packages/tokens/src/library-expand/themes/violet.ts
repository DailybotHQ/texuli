import type { LibraryThemeDefinition } from '../../library-port/types.ts';

const definition = {
  id: 'violet',
  name: 'Violet',
  description: 'Calm zinc neutrals with a violet accent (Protoyard built-in port).',
  category: 'builtin',
  tags: ['builtin', 'default', 'violet'] as const,
  collection: 'brand-like',
  mood: ['calm', 'minimal'] as const,
  seed: '#7c3aed',
  secondary: '#0ea5e9',
  neutral: 'zinc',
  radius: '0.625rem',
} satisfies LibraryThemeDefinition;

export default definition;
