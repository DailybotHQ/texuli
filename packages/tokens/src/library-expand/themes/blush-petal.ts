import type { LibraryThemeDefinition } from '../../library-port/types.ts';

const definition = {
  id: 'blush-petal',
  name: 'Blush Petal',
  description: 'Blush Petal: curated pastel family theme for the expanded library.',
  category: 'pastel',
  tags: ['pastel', 'expanded', 'curated'] as const,
  collection: 'seasonal',
  mood: ['playful', 'calm'] as const,
  contrastLevel: 'AA',
  seed: '#fb7185',
  secondary: '#f43f5e',
  neutral: 'warm',
  radius: '0.625rem',
  density: 1,
} satisfies LibraryThemeDefinition;

export default definition;
