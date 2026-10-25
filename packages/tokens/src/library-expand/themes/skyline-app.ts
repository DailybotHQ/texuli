import type { LibraryThemeDefinition } from '../../library-port/types.ts';

const definition = {
  id: 'skyline-app',
  name: 'Skyline App',
  description: 'Skyline App: curated cool family theme for the expanded library.',
  category: 'cool',
  tags: ['cool', 'expanded', 'curated'] as const,
  collection: 'industry',
  mood: ['calm', 'technical'] as const,
  contrastLevel: 'AA',
  seed: '#0369a1',
  secondary: '#075985',
  neutral: 'slate',
  radius: '0.625rem',
  density: 1,
} satisfies LibraryThemeDefinition;

export default definition;
