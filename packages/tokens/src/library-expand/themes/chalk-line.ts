import type { LibraryThemeDefinition } from '../../library-port/types.ts';

const definition = {
  id: 'chalk-line',
  name: 'Chalk Line',
  description: 'Chalk Line: curated neutral family theme for the expanded library.',
  category: 'neutral',
  tags: ['neutral', 'expanded', 'curated'] as const,
  collection: 'mono',
  mood: ['minimal'] as const,
  contrastLevel: 'AA',
  seed: '#a8a29e',
  secondary: '#78716c',
  neutral: 'zinc',
  radius: '0.625rem',
  density: 1,
} satisfies LibraryThemeDefinition;

export default definition;
