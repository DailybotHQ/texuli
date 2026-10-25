import type { LibraryThemeDefinition } from '../../library-port/types.ts';

const definition = {
  id: 'trace-indigo',
  name: 'Trace Indigo',
  description: 'Trace Indigo: curated terminal family theme for the expanded library.',
  category: 'terminal',
  tags: ['terminal', 'expanded', 'curated'] as const,
  collection: 'industry',
  mood: ['technical'] as const,
  darkFirst: true,
  contrastLevel: 'AA',
  seed: '#5c44dd',
  secondary: '#4338ca',
  neutral: 'zinc',
  radius: '0.625rem',
  density: 1,
} satisfies LibraryThemeDefinition;

export default definition;
