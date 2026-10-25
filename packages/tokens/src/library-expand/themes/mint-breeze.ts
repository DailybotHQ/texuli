import type { LibraryThemeDefinition } from '../../library-port/types.ts';

const definition = {
  id: 'mint-breeze',
  name: 'Mint Breeze',
  description: 'Mint Breeze: curated pastel family theme for the expanded library.',
  category: 'pastel',
  tags: ['pastel', 'expanded', 'curated'] as const,
  collection: 'seasonal',
  mood: ['playful', 'calm'] as const,
  contrastLevel: 'AA',
  seed: '#34d399',
  secondary: '#10b981',
  neutral: 'warm',
  radius: '0.625rem',
  density: 1,
} satisfies LibraryThemeDefinition;

export default definition;
