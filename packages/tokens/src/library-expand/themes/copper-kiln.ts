import type { LibraryThemeDefinition } from '../../library-port/types.ts';

const definition = {
  id: 'copper-kiln',
  name: 'Copper Kiln',
  description: 'Copper Kiln: curated warm family theme for the expanded library.',
  category: 'warm',
  tags: ['warm', 'expanded', 'curated'] as const,
  collection: 'industry',
  mood: ['warm'] as const,
  contrastLevel: 'AA',
  seed: '#a26a00',
  secondary: '#92400e',
  neutral: 'stone',
  radius: '0.625rem',
  density: 1,
} satisfies LibraryThemeDefinition;

export default definition;
