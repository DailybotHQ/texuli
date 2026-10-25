import type { LibraryThemeDefinition } from '../../library-port/types.ts';

const definition = {
  id: 'soil-brown',
  name: 'Soil Brown',
  description: 'Soil Brown: curated earthy family theme for the expanded library.',
  category: 'earthy',
  tags: ['earthy', 'expanded', 'curated'] as const,
  collection: 'industry',
  mood: ['warm', 'editorial'] as const,
  contrastLevel: 'AA',
  seed: '#793e00',
  secondary: '#451a03',
  neutral: 'stone',
  radius: '0.625rem',
  density: 1,
} satisfies LibraryThemeDefinition;

export default definition;
