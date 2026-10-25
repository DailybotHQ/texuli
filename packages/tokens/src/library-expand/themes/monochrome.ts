import type { LibraryThemeDefinition } from '../../library-port/types.ts';

const definition = {
  id: 'monochrome',
  name: 'Monochrome',
  description: 'Pure grayscale, crisp corners — wireframe-grade focus (Protoyard built-in port).',
  category: 'builtin',
  tags: ['builtin', 'mono', 'wireframe'] as const,
  collection: 'mono',
  mood: ['minimal', 'technical'] as const,
  seed: '#18181b',
  secondary: '#52525b',
  neutral: 'zinc',
  radius: '0.375rem',
  style: { elevation: 'flat', shape: { borderWidth: '1px', radiusScale: 0.6 } },
} satisfies LibraryThemeDefinition;

export default definition;
