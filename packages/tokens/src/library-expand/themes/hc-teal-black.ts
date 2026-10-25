import type { LibraryThemeDefinition } from '../../library-port/types.ts';

const definition = {
  id: 'hc-teal-black',
  name: 'HC Teal Black',
  description: 'HC Teal Black: curated high-contrast family theme for the expanded library.',
  category: 'high-contrast',
  tags: ['high-contrast', 'expanded', 'curated'] as const,
  collection: 'high-contrast',
  mood: ['minimal'] as const,
  contrastLevel: 'AAA',
  seed: '#117a7c',
  secondary: '#134e4a',
  neutral: 'zinc',
  radius: '0.625rem',
  density: 1,
} satisfies LibraryThemeDefinition;

export default definition;
