import type { LibraryThemeDefinition } from '../../library-port/types.ts';

const definition = {
  id: 'aqua-foam',
  name: 'Aqua Foam',
  description: 'Aqua Foam: curated pastel family theme for the expanded library.',
  category: 'pastel',
  tags: ['pastel', 'expanded', 'curated'] as const,
  collection: 'seasonal',
  mood: ['playful', 'calm'] as const,
  contrastLevel: 'AA',
  seed: '#5eead4',
  secondary: '#2dd4bf',
  neutral: 'warm',
  radius: '0.625rem',
  density: 1,
} satisfies LibraryThemeDefinition;

export default definition;
