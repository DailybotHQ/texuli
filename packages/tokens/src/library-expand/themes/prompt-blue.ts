import type { LibraryThemeDefinition } from '../../library-port/types.ts';

const definition = {
  id: 'prompt-blue',
  name: 'Prompt Blue',
  description: 'Prompt Blue: curated terminal family theme for the expanded library.',
  category: 'terminal',
  tags: ['terminal', 'expanded', 'curated'] as const,
  collection: 'industry',
  mood: ['technical'] as const,
  darkFirst: true,
  contrastLevel: 'AA',
  seed: '#535ff0',
  secondary: '#1d4ed8',
  neutral: 'zinc',
  radius: '0.625rem',
  density: 1,
} satisfies LibraryThemeDefinition;

export default definition;
