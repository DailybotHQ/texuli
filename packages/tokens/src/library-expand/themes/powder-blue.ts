import type { LibraryThemeDefinition } from '../../library-port/types.ts';

const definition = {
  id: 'powder-blue',
  name: 'Powder Blue',
  description: 'Powder Blue: curated pastel family theme for the expanded library.',
  category: 'pastel',
  tags: ['pastel', 'expanded', 'curated'] as const,
  collection: 'seasonal',
  mood: ['playful', 'calm'] as const,
  contrastLevel: 'AA',
  seed: '#93c5fd',
  secondary: '#60a5fa',
  neutral: 'warm',
  radius: '0.625rem',
  density: 1,
} satisfies LibraryThemeDefinition;

export default definition;
