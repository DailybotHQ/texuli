import type { LibraryThemeDefinition } from '../../library-port/types.ts';

const definition = {
  id: 'butter-cream',
  name: 'Butter Cream',
  description: 'Butter Cream: curated pastel family theme for the expanded library.',
  category: 'pastel',
  tags: ['pastel', 'expanded', 'curated'] as const,
  collection: 'seasonal',
  mood: ['playful', 'calm'] as const,
  contrastLevel: 'AA',
  seed: '#fbbf24',
  secondary: '#f59e0b',
  neutral: 'warm',
  radius: '0.625rem',
  density: 1,
} satisfies LibraryThemeDefinition;

export default definition;
