import type { LibraryThemeDefinition } from '../../library-port/types.ts';

const definition = {
  id: 'coral-market',
  name: 'Coral Market',
  description: 'Coral Market: curated warm family theme for the expanded library.',
  category: 'warm',
  tags: ['warm', 'expanded', 'curated'] as const,
  collection: 'industry',
  mood: ['warm'] as const,
  contrastLevel: 'AA',
  seed: '#e11d48',
  secondary: '#be123c',
  neutral: 'stone',
  radius: '0.625rem',
  density: 1,
} satisfies LibraryThemeDefinition;

export default definition;
