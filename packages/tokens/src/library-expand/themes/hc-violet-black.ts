import type { LibraryThemeDefinition } from '../../library-port/types.ts';

const definition = {
  id: 'hc-violet-black',
  name: 'HC Violet Black',
  description: 'HC Violet Black: curated high-contrast family theme for the expanded library.',
  category: 'high-contrast',
  tags: ['high-contrast', 'expanded', 'curated'] as const,
  collection: 'high-contrast',
  mood: ['minimal'] as const,
  contrastLevel: 'AAA',
  seed: '#6d28d9',
  secondary: '#2e1065',
  neutral: 'zinc',
  radius: '0.625rem',
  density: 1,
} satisfies LibraryThemeDefinition;

export default definition;
