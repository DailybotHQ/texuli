import type { LibraryThemeDefinition } from '../../library-port/types.ts';

const definition = {
  id: 'ocean',
  name: 'Ocean',
  description: 'Cool slate surfaces and a confident blue — classic SaaS (Protoyard built-in port).',
  category: 'builtin',
  tags: ['builtin', 'saas', 'blue'] as const,
  collection: 'brand-like',
  mood: ['corporate', 'calm'] as const,
  seed: '#2563eb',
  secondary: '#0891b2',
  neutral: 'slate',
  radius: '0.625rem',
} satisfies LibraryThemeDefinition;

export default definition;
