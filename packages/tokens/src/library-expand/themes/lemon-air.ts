import type { LibraryThemeDefinition } from '../../library-port/types.ts';

const definition = {
  id: 'lemon-air',
  name: 'Lemon Air',
  description: 'Lemon Air: curated pastel family theme for the expanded library.',
  category: 'pastel',
  tags: ['pastel', 'expanded', 'curated'] as const,
  collection: 'seasonal',
  mood: ['playful', 'calm'] as const,
  contrastLevel: 'AA',
  seed: '#fde047',
  secondary: '#facc15',
  neutral: 'warm',
  radius: '0.625rem',
  density: 1,
} satisfies LibraryThemeDefinition;

export default definition;
