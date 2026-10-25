import type { LibraryThemeDefinition } from '../../library-port/types.ts';

const definition = {
  id: 'cinnamon-bar',
  name: 'Cinnamon Bar',
  description: 'Cinnamon Bar: curated warm family theme for the expanded library.',
  category: 'warm',
  tags: ['warm', 'expanded', 'curated'] as const,
  collection: 'industry',
  mood: ['warm'] as const,
  contrastLevel: 'AA',
  seed: '#9f1239',
  secondary: '#881337',
  neutral: 'stone',
  radius: '0.625rem',
  density: 1,
} satisfies LibraryThemeDefinition;

export default definition;
