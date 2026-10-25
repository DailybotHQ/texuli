import type { LibraryThemeDefinition } from '../../library-port/types.ts';

const definition = {
  id: 'pewter-grid',
  name: 'Pewter Grid',
  description: 'Pewter Grid: curated neutral family theme for the expanded library.',
  category: 'neutral',
  tags: ['neutral', 'expanded', 'curated'] as const,
  collection: 'mono',
  mood: ['minimal'] as const,
  contrastLevel: 'AA',
  seed: '#57534e',
  secondary: '#78716c',
  neutral: 'zinc',
  radius: '0.625rem',
  density: 1,
} satisfies LibraryThemeDefinition;

export default definition;
