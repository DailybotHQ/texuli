import type { LibraryThemeDefinition } from '../../library-port/types.ts';

const definition = {
  id: 'forest-floor',
  name: 'Forest Floor',
  description: 'Forest Floor: curated earthy family theme for the expanded library.',
  category: 'earthy',
  tags: ['earthy', 'expanded', 'curated'] as const,
  collection: 'industry',
  mood: ['warm', 'editorial'] as const,
  contrastLevel: 'AA',
  seed: '#166534',
  secondary: '#14532d',
  neutral: 'stone',
  radius: '0.625rem',
  density: 1,
} satisfies LibraryThemeDefinition;

export default definition;
