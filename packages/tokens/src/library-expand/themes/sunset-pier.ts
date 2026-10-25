import type { LibraryThemeDefinition } from '../../library-port/types.ts';

const definition = {
  id: 'sunset-pier',
  name: 'Sunset Pier',
  description: 'Sunset Pier: curated warm family theme for the expanded library.',
  category: 'warm',
  tags: ['warm', 'expanded', 'curated'] as const,
  collection: 'industry',
  mood: ['warm'] as const,
  contrastLevel: 'AA',
  seed: '#f97316',
  secondary: '#ea580c',
  neutral: 'stone',
  radius: '0.625rem',
  density: 1,
} satisfies LibraryThemeDefinition;

export default definition;
