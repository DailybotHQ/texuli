import type { LibraryThemeDefinition } from '../../library-port/types.ts';

const definition = {
  id: 'clay-workshop',
  name: 'Clay Workshop',
  description: 'Clay Workshop: curated warm family theme for the expanded library.',
  category: 'warm',
  tags: ['warm', 'expanded', 'curated'] as const,
  collection: 'industry',
  mood: ['warm'] as const,
  contrastLevel: 'AA',
  seed: '#a16207',
  secondary: '#854d0e',
  neutral: 'stone',
  radius: '0.625rem',
  density: 1,
} satisfies LibraryThemeDefinition;

export default definition;
