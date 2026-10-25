import type { LibraryThemeDefinition } from '../../library-port/types.ts';

const definition = {
  id: 'pistachio-tile',
  name: 'Pistachio Tile',
  description: 'Pistachio Tile: curated pastel family theme for the expanded library.',
  category: 'pastel',
  tags: ['pastel', 'expanded', 'curated'] as const,
  collection: 'seasonal',
  mood: ['playful', 'calm'] as const,
  contrastLevel: 'AA',
  seed: '#bef264',
  secondary: '#a3e635',
  neutral: 'warm',
  radius: '0.625rem',
  density: 1,
} satisfies LibraryThemeDefinition;

export default definition;
