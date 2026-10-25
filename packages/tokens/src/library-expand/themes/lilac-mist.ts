import type { LibraryThemeDefinition } from '../../library-port/types.ts';

const definition = {
  id: 'lilac-mist',
  name: 'Lilac Mist',
  description: 'Lilac Mist: curated pastel family theme for the expanded library.',
  category: 'pastel',
  tags: ['pastel', 'expanded', 'curated'] as const,
  collection: 'seasonal',
  mood: ['playful', 'calm'] as const,
  contrastLevel: 'AA',
  seed: '#a78bfa',
  secondary: '#8b5cf6',
  neutral: 'warm',
  radius: '0.625rem',
  density: 1,
} satisfies LibraryThemeDefinition;

export default definition;
