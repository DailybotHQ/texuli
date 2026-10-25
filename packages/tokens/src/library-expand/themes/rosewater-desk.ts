import type { LibraryThemeDefinition } from '../../library-port/types.ts';

const definition = {
  id: 'rosewater-desk',
  name: 'Rosewater Desk',
  description: 'Rosewater Desk: curated pastel family theme for the expanded library.',
  category: 'pastel',
  tags: ['pastel', 'expanded', 'curated'] as const,
  collection: 'seasonal',
  mood: ['playful', 'calm'] as const,
  contrastLevel: 'AA',
  seed: '#fda4af',
  secondary: '#fb7185',
  neutral: 'warm',
  radius: '0.625rem',
  density: 1,
} satisfies LibraryThemeDefinition;

export default definition;
