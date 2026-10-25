import type { LibraryThemeDefinition } from '../../library-port/types.ts';

const definition = {
  id: 'peach-studio',
  name: 'Peach Studio',
  description: 'Peach Studio: curated warm family theme for the expanded library.',
  category: 'warm',
  tags: ['warm', 'expanded', 'curated'] as const,
  collection: 'industry',
  mood: ['warm'] as const,
  contrastLevel: 'AA',
  seed: '#e26200',
  secondary: '#c2410c',
  neutral: 'stone',
  radius: '0.625rem',
  density: 1,
} satisfies LibraryThemeDefinition;

export default definition;
