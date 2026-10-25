import type { LibraryThemeDefinition } from '../../library-port/types.ts';

const definition = {
  id: 'hc-blue-white',
  name: 'HC Blue White',
  description: 'HC Blue White: curated high-contrast family theme for the expanded library.',
  category: 'high-contrast',
  tags: ['high-contrast', 'expanded', 'curated'] as const,
  collection: 'high-contrast',
  mood: ['minimal'] as const,
  contrastLevel: 'AAA',
  seed: '#3549d8',
  secondary: '#0f172a',
  neutral: 'zinc',
  radius: '0.625rem',
  density: 1,
} satisfies LibraryThemeDefinition;

export default definition;
