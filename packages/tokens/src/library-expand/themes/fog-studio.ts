import type { LibraryThemeDefinition } from '../../library-port/types.ts';

const definition = {
  id: 'fog-studio',
  name: 'Fog Studio',
  description: 'Fog Studio: curated neutral family theme for the expanded library.',
  category: 'neutral',
  tags: ['neutral', 'expanded', 'curated'] as const,
  collection: 'mono',
  mood: ['minimal'] as const,
  contrastLevel: 'AA',
  seed: '#676b85',
  secondary: '#4b5563',
  neutral: 'zinc',
  radius: '0.625rem',
  density: 1,
} satisfies LibraryThemeDefinition;

export default definition;
