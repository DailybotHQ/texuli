import type { LibraryThemeDefinition } from '../../library-port/types.ts';

const definition = {
  id: 'dove-note',
  name: 'Dove Note',
  description: 'Dove Note: curated neutral family theme for the expanded library.',
  category: 'neutral',
  tags: ['neutral', 'expanded', 'curated'] as const,
  collection: 'mono',
  mood: ['minimal'] as const,
  contrastLevel: 'AA',
  seed: '#9ca3af',
  secondary: '#6b7280',
  neutral: 'zinc',
  radius: '0.625rem',
  density: 1,
} satisfies LibraryThemeDefinition;

export default definition;
