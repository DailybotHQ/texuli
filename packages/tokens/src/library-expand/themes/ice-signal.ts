import type { LibraryThemeDefinition } from '../../library-port/types.ts';

const definition = {
  id: 'ice-signal',
  name: 'Ice Signal',
  description: 'Ice Signal: curated cool family theme for the expanded library.',
  category: 'cool',
  tags: ['cool', 'expanded', 'curated'] as const,
  collection: 'industry',
  mood: ['calm', 'technical'] as const,
  contrastLevel: 'AA',
  seed: '#30b4e0',
  secondary: '#0891b2',
  neutral: 'slate',
  radius: '0.625rem',
  density: 1,
} satisfies LibraryThemeDefinition;

export default definition;
