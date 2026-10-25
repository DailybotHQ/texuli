import type { LibraryThemeDefinition } from '../../library-port/types.ts';

const definition = {
  id: 'root-red',
  name: 'Root Red',
  description: 'Root Red: curated terminal family theme for the expanded library.',
  category: 'terminal',
  tags: ['terminal', 'expanded', 'curated'] as const,
  collection: 'industry',
  mood: ['technical'] as const,
  darkFirst: true,
  contrastLevel: 'AA',
  seed: '#c35300',
  secondary: '#b91c1c',
  neutral: 'zinc',
  radius: '0.625rem',
  density: 1,
} satisfies LibraryThemeDefinition;

export default definition;
