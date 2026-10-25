import type { LibraryThemeDefinition } from '../../library-port/types.ts';

const definition = {
  id: 'maroon-hall',
  name: 'Maroon Hall',
  description: 'Maroon Hall: curated warm family theme for the expanded library.',
  category: 'warm',
  tags: ['warm', 'expanded', 'curated'] as const,
  collection: 'industry',
  mood: ['warm'] as const,
  contrastLevel: 'AA',
  seed: '#9b0d12',
  secondary: '#be123c',
  neutral: 'stone',
  radius: '0.625rem',
  density: 1,
} satisfies LibraryThemeDefinition;

export default definition;
