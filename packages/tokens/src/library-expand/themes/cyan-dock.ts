import type { LibraryThemeDefinition } from '../../library-port/types.ts';

const definition = {
  id: 'cyan-dock',
  name: 'Cyan Dock',
  description: 'Cyan Dock: curated cool family theme for the expanded library.',
  category: 'cool',
  tags: ['cool', 'expanded', 'curated'] as const,
  collection: 'industry',
  mood: ['calm', 'technical'] as const,
  contrastLevel: 'AA',
  seed: '#0891b2',
  secondary: '#0e7490',
  neutral: 'slate',
  radius: '0.625rem',
  density: 1,
} satisfies LibraryThemeDefinition;

export default definition;
