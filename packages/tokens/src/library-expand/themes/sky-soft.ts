import type { LibraryThemeDefinition } from '../../library-port/types.ts';

const definition = {
  id: 'sky-soft',
  name: 'Sky Soft',
  description: 'Sky Soft: curated pastel family theme for the expanded library.',
  category: 'pastel',
  tags: ['pastel', 'expanded', 'curated'] as const,
  collection: 'seasonal',
  mood: ['playful', 'calm'] as const,
  contrastLevel: 'AA',
  seed: '#7dd3fc',
  secondary: '#38bdf8',
  neutral: 'warm',
  radius: '0.625rem',
  density: 1,
} satisfies LibraryThemeDefinition;

export default definition;
