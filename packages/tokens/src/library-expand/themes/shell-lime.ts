import type { LibraryThemeDefinition } from '../../library-port/types.ts';

const definition = {
  id: 'shell-lime',
  name: 'Shell Lime',
  description: 'Shell Lime: curated terminal family theme for the expanded library.',
  category: 'terminal',
  tags: ['terminal', 'expanded', 'curated'] as const,
  collection: 'industry',
  mood: ['technical'] as const,
  darkFirst: true,
  contrastLevel: 'AA',
  seed: '#4ea936',
  secondary: '#4d7c0f',
  neutral: 'zinc',
  radius: '0.625rem',
  density: 1,
} satisfies LibraryThemeDefinition;

export default definition;
