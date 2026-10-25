import type { LibraryThemeDefinition } from '../../library-port/types.ts';

const definition = {
  id: 'hc-white-blue',
  name: 'HC White Blue',
  description: 'HC White Blue: curated high-contrast family theme for the expanded library.',
  category: 'high-contrast',
  tags: ['high-contrast', 'expanded', 'curated'] as const,
  collection: 'high-contrast',
  mood: ['minimal'] as const,
  contrastLevel: 'AAA',
  seed: '#20283d',
  secondary: '#38bdf8',
  neutral: 'zinc',
  radius: '0.625rem',
  density: 1,
} satisfies LibraryThemeDefinition;

export default definition;
