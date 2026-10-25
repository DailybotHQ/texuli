import type { LibraryThemeDefinition } from '../../library-port/types.ts';

const definition = {
  id: 'peach-foam',
  name: 'Peach Foam',
  description: 'Peach Foam: curated pastel family theme for the expanded library.',
  category: 'pastel',
  tags: ['pastel', 'expanded', 'curated'] as const,
  collection: 'seasonal',
  mood: ['playful', 'calm'] as const,
  contrastLevel: 'AA',
  seed: '#fdba74',
  secondary: '#fb923c',
  neutral: 'warm',
  radius: '0.625rem',
  density: 1,
} satisfies LibraryThemeDefinition;

export default definition;
