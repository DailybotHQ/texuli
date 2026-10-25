import type { LibraryThemeDefinition } from '../../library-port/types.ts';

const definition = {
  id: 'hc-paper-ink',
  name: 'HC Paper Ink',
  description: 'HC Paper Ink: curated high-contrast family theme for the expanded library.',
  category: 'high-contrast',
  tags: ['high-contrast', 'expanded', 'curated'] as const,
  collection: 'high-contrast',
  mood: ['minimal'] as const,
  contrastLevel: 'AAA',
  seed: '#111827',
  secondary: '#f59e0b',
  neutral: 'zinc',
  radius: '0.625rem',
  density: 1,
} satisfies LibraryThemeDefinition;

export default definition;
