import type { LibraryThemeDefinition } from '../../library-port/types.ts';

const definition = {
  id: 'orchid-note',
  name: 'Orchid Note',
  description: 'Orchid Note: curated pastel family theme for the expanded library.',
  category: 'pastel',
  tags: ['pastel', 'expanded', 'curated'] as const,
  collection: 'seasonal',
  mood: ['playful', 'calm'] as const,
  contrastLevel: 'AA',
  seed: '#e879f9',
  secondary: '#d946ef',
  neutral: 'warm',
  radius: '0.625rem',
  density: 1,
} satisfies LibraryThemeDefinition;

export default definition;
