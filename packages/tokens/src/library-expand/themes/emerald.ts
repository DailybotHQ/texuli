import type { LibraryThemeDefinition } from '../../library-port/types.ts';

const definition = {
  id: 'emerald',
  name: 'Emerald',
  description:
    'Fresh green on soft gray — finance, health and sustainability (Protoyard built-in port).',
  category: 'builtin',
  tags: ['builtin', 'green', 'finance'] as const,
  collection: 'brand-like',
  mood: ['fresh', 'corporate'] as const,
  seed: '#047857',
  secondary: '#0e7490',
  neutral: 'gray',
  radius: '0.625rem',
} satisfies LibraryThemeDefinition;

export default definition;
