import type { LibraryThemeDefinition } from '../../library-port/types.ts';

const definition = {
  id: 'amber',
  name: 'Amber',
  description: 'Sunny amber with dark text — energetic dashboards (Protoyard built-in port).',
  category: 'builtin',
  tags: ['builtin', 'amber', 'energy'] as const,
  collection: 'brand-like',
  mood: ['bold', 'warm'] as const,
  seed: '#b45309',
  secondary: '#c2410c',
  neutral: 'stone',
  radius: '0.625rem',
} satisfies LibraryThemeDefinition;

export default definition;
