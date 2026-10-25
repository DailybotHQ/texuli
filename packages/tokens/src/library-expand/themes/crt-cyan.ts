import type { LibraryThemeDefinition } from '../../library-port/types.ts';

const definition = {
  id: 'crt-cyan',
  name: 'CRT Cyan',
  description: 'CRT Cyan: curated terminal family theme for the expanded library.',
  category: 'terminal',
  tags: ['terminal', 'expanded', 'curated'] as const,
  collection: 'industry',
  mood: ['technical'] as const,
  darkFirst: true,
  contrastLevel: 'AA',
  seed: '#06b6d4',
  secondary: '#0891b2',
  neutral: 'zinc',
  radius: '0.625rem',
  density: 1,
} satisfies LibraryThemeDefinition;

export default definition;
