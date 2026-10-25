import type { LibraryThemeDefinition } from '../../library-port/types.ts';

const definition = {
  id: 'silver-rail',
  name: 'Silver Rail',
  description: 'Silver Rail: curated neutral family theme for the expanded library.',
  category: 'neutral',
  tags: ['neutral', 'expanded', 'curated'] as const,
  collection: 'mono',
  mood: ['minimal'] as const,
  contrastLevel: 'AA',
  seed: '#86676f',
  secondary: '#525252',
  neutral: 'zinc',
  radius: '0.625rem',
  density: 1,
} satisfies LibraryThemeDefinition;

export default definition;
