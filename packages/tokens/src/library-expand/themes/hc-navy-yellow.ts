import type { LibraryThemeDefinition } from '../../library-port/types.ts';

const definition = {
  id: 'hc-navy-yellow',
  name: 'HC Navy Yellow',
  description: 'HC Navy Yellow: curated high-contrast family theme for the expanded library.',
  category: 'high-contrast',
  tags: ['high-contrast', 'expanded', 'curated'] as const,
  collection: 'high-contrast',
  mood: ['minimal'] as const,
  contrastLevel: 'AAA',
  seed: '#1e3a8a',
  secondary: '#fbbf24',
  neutral: 'zinc',
  radius: '0.625rem',
  density: 1,
} satisfies LibraryThemeDefinition;

export default definition;
