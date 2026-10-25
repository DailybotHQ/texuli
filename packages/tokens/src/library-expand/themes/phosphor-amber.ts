import type { LibraryThemeDefinition } from '../../library-port/types.ts';

const definition = {
  id: 'phosphor-amber',
  name: 'Phosphor Amber',
  description: 'Phosphor Amber: curated terminal family theme for the expanded library.',
  category: 'terminal',
  tags: ['terminal', 'expanded', 'curated'] as const,
  collection: 'industry',
  mood: ['technical'] as const,
  darkFirst: true,
  contrastLevel: 'AA',
  seed: '#d38100',
  secondary: '#b45309',
  neutral: 'zinc',
  radius: '0.625rem',
  density: 1,
} satisfies LibraryThemeDefinition;

export default definition;
