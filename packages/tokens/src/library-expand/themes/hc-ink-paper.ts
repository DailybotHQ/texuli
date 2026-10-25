import type { LibraryThemeDefinition } from '../../library-port/types.ts';

const definition = {
  id: 'hc-ink-paper',
  name: 'HC Ink Paper',
  description: 'HC Ink Paper: curated high-contrast family theme for the expanded library.',
  category: 'high-contrast',
  tags: ['high-contrast', 'expanded', 'curated'] as const,
  collection: 'high-contrast',
  mood: ['minimal'] as const,
  contrastLevel: 'AAA',
  seed: '#000000',
  secondary: '#2563eb',
  neutral: 'zinc',
  radius: '0.625rem',
  density: 1,
} satisfies LibraryThemeDefinition;

export default definition;
