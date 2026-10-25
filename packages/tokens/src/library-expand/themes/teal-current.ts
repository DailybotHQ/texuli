import type { LibraryThemeDefinition } from '../../library-port/types.ts';

const definition = {
  id: 'teal-current',
  name: 'Teal Current',
  description: 'Teal Current: curated cool family theme for the expanded library.',
  category: 'cool',
  tags: ['cool', 'expanded', 'curated'] as const,
  collection: 'industry',
  mood: ['calm', 'technical'] as const,
  contrastLevel: 'AA',
  seed: '#089899',
  secondary: '#0f766e',
  neutral: 'slate',
  radius: '0.625rem',
  density: 1,
} satisfies LibraryThemeDefinition;

export default definition;
