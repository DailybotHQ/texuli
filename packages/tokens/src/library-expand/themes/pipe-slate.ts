import type { LibraryThemeDefinition } from '../../library-port/types.ts';

const definition = {
  id: 'pipe-slate',
  name: 'Pipe Slate',
  description: 'Pipe Slate: curated terminal family theme for the expanded library.',
  category: 'terminal',
  tags: ['terminal', 'expanded', 'curated'] as const,
  collection: 'industry',
  mood: ['technical'] as const,
  darkFirst: true,
  contrastLevel: 'AA',
  seed: '#73758f',
  secondary: '#475569',
  neutral: 'zinc',
  radius: '0.625rem',
  density: 1,
} satisfies LibraryThemeDefinition;

export default definition;
