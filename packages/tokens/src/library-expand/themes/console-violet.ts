import type { LibraryThemeDefinition } from '../../library-port/types.ts';

const definition = {
  id: 'console-violet',
  name: 'Console Violet',
  description: 'Console Violet: curated terminal family theme for the expanded library.',
  category: 'terminal',
  tags: ['terminal', 'expanded', 'curated'] as const,
  collection: 'industry',
  mood: ['technical'] as const,
  darkFirst: true,
  contrastLevel: 'AA',
  seed: '#7c41da',
  secondary: '#6d28d9',
  neutral: 'zinc',
  radius: '0.625rem',
  density: 1,
} satisfies LibraryThemeDefinition;

export default definition;
