import type { LibraryThemeDefinition } from '../../library-port/types.ts';

const definition = {
  id: 'stack-yellow',
  name: 'Stack Yellow',
  description: 'Stack Yellow: curated terminal family theme for the expanded library.',
  category: 'terminal',
  tags: ['terminal', 'expanded', 'curated'] as const,
  collection: 'industry',
  mood: ['technical'] as const,
  darkFirst: true,
  contrastLevel: 'AA',
  seed: '#b58e00',
  secondary: '#a16207',
  neutral: 'zinc',
  radius: '0.625rem',
  density: 1,
} satisfies LibraryThemeDefinition;

export default definition;
