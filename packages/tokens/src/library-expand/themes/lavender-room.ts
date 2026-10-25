import type { LibraryThemeDefinition } from '../../library-port/types.ts';

const definition = {
  id: 'lavender-room',
  name: 'Lavender Room',
  description: 'Lavender Room: curated pastel family theme for the expanded library.',
  category: 'pastel',
  tags: ['pastel', 'expanded', 'curated'] as const,
  collection: 'seasonal',
  mood: ['playful', 'calm'] as const,
  contrastLevel: 'AA',
  seed: '#c4b5fd',
  secondary: '#a78bfa',
  neutral: 'warm',
  radius: '0.625rem',
  density: 1,
} satisfies LibraryThemeDefinition;

export default definition;
