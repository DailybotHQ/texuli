import type { LibraryThemeDefinition } from '../../library-port/types.ts';

const definition = {
  id: 'hc-amber-black',
  name: 'HC Amber Black',
  description: 'HC Amber Black: curated high-contrast family theme for the expanded library.',
  category: 'high-contrast',
  tags: ['high-contrast', 'expanded', 'curated'] as const,
  collection: 'high-contrast',
  mood: ['minimal'] as const,
  contrastLevel: 'AAA',
  seed: '#956e00',
  secondary: '#451a03',
  neutral: 'zinc',
  radius: '0.625rem',
  density: 1,
} satisfies LibraryThemeDefinition;

export default definition;
