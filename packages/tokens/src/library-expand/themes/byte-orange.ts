import type { LibraryThemeDefinition } from '../../library-port/types.ts';

const definition = {
  id: 'byte-orange',
  name: 'Byte Orange',
  description: 'Byte Orange: curated terminal family theme for the expanded library.',
  category: 'terminal',
  tags: ['terminal', 'expanded', 'curated'] as const,
  collection: 'industry',
  mood: ['technical'] as const,
  darkFirst: true,
  contrastLevel: 'AA',
  seed: '#ea580c',
  secondary: '#c2410c',
  neutral: 'zinc',
  radius: '0.625rem',
  density: 1,
} satisfies LibraryThemeDefinition;

export default definition;
