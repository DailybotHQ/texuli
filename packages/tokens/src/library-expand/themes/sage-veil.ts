import type { LibraryThemeDefinition } from '../../library-port/types.ts';

const definition = {
  id: 'sage-veil',
  name: 'Sage Veil',
  description: 'Sage Veil: curated pastel family theme for the expanded library.',
  category: 'pastel',
  tags: ['pastel', 'expanded', 'curated'] as const,
  collection: 'seasonal',
  mood: ['playful', 'calm'] as const,
  contrastLevel: 'AA',
  seed: '#86efac',
  secondary: '#4ade80',
  neutral: 'warm',
  radius: '0.625rem',
  density: 1,
} satisfies LibraryThemeDefinition;

export default definition;
