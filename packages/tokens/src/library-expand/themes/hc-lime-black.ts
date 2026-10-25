import type { LibraryThemeDefinition } from '../../library-port/types.ts';

const definition = {
  id: 'hc-lime-black',
  name: 'HC Lime Black',
  description: 'HC Lime Black: curated high-contrast family theme for the expanded library.',
  category: 'high-contrast',
  tags: ['high-contrast', 'expanded', 'curated'] as const,
  collection: 'high-contrast',
  mood: ['minimal'] as const,
  contrastLevel: 'AAA',
  seed: '#3c812a',
  secondary: '#1a2e05',
  neutral: 'zinc',
  radius: '0.625rem',
  density: 1,
} satisfies LibraryThemeDefinition;

export default definition;
