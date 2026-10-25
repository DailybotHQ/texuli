import type { LibraryThemeDefinition } from '../../library-port/types.ts';

const definition = {
  id: 'rose',
  name: 'Rose',
  description: 'Warm stone with a rose accent — consumer and lifestyle (Protoyard built-in port).',
  category: 'builtin',
  tags: ['builtin', 'rose', 'consumer'] as const,
  collection: 'brand-like',
  mood: ['warm', 'playful'] as const,
  seed: '#be123c',
  secondary: '#c2410c',
  neutral: 'stone',
  radius: '0.875rem',
} satisfies LibraryThemeDefinition;

export default definition;
