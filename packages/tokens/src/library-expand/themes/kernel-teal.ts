import type { LibraryThemeDefinition } from '../../library-port/types.ts';

const definition = {
  id: 'kernel-teal',
  name: 'Kernel Teal',
  description: 'Kernel Teal: curated terminal family theme for the expanded library.',
  category: 'terminal',
  tags: ['terminal', 'expanded', 'curated'] as const,
  collection: 'industry',
  mood: ['technical'] as const,
  darkFirst: true,
  contrastLevel: 'AA',
  seed: '#0d9488',
  secondary: '#0f766e',
  neutral: 'zinc',
  radius: '0.625rem',
  density: 1,
} satisfies LibraryThemeDefinition;

export default definition;
