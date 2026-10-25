import type { LibraryThemeDefinition } from '../../library-port/types.ts';

const definition = {
  id: 'iron-wire',
  name: 'Iron Wire',
  description: 'Iron Wire: curated neutral family theme for the expanded library.',
  category: 'neutral',
  tags: ['neutral', 'expanded', 'curated'] as const,
  collection: 'mono',
  mood: ['minimal'] as const,
  contrastLevel: 'AA',
  seed: '#4c3b27',
  secondary: '#292524',
  neutral: 'zinc',
  radius: '0.625rem',
  density: 1,
} satisfies LibraryThemeDefinition;

export default definition;
