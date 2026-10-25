import type { LibraryThemeDefinition } from '../../library-port/types.ts';

const definition = {
  id: 'hc-cyan-black',
  name: 'HC Cyan Black',
  description: 'HC Cyan Black: curated high-contrast family theme for the expanded library.',
  category: 'high-contrast',
  tags: ['high-contrast', 'expanded', 'curated'] as const,
  collection: 'high-contrast',
  mood: ['minimal'] as const,
  contrastLevel: 'AAA',
  seed: '#0e7490',
  secondary: '#083344',
  neutral: 'zinc',
  radius: '0.625rem',
  density: 1,
} satisfies LibraryThemeDefinition;

export default definition;
