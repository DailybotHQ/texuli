import type { LibraryThemeDefinition } from '../../library-port/types.ts';

const definition = {
  id: 'honey-desk',
  name: 'Honey Desk',
  description: 'Honey Desk: curated warm family theme for the expanded library.',
  category: 'warm',
  tags: ['warm', 'expanded', 'curated'] as const,
  collection: 'industry',
  mood: ['warm'] as const,
  contrastLevel: 'AA',
  seed: '#c49200',
  secondary: '#a16207',
  neutral: 'stone',
  radius: '0.625rem',
  density: 1,
} satisfies LibraryThemeDefinition;

export default definition;
