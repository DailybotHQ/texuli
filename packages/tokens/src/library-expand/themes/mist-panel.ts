import type { LibraryThemeDefinition } from '../../library-port/types.ts';

const definition = {
  id: 'mist-panel',
  name: 'Mist Panel',
  description: 'Mist Panel: curated neutral family theme for the expanded library.',
  category: 'neutral',
  tags: ['neutral', 'expanded', 'curated'] as const,
  collection: 'mono',
  mood: ['minimal'] as const,
  contrastLevel: 'AA',
  seed: '#9e9cb8',
  secondary: '#71717a',
  neutral: 'zinc',
  radius: '0.625rem',
  density: 1,
} satisfies LibraryThemeDefinition;

export default definition;
