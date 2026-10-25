import type { LibraryThemeDefinition } from '../../library-port/types.ts';

const definition = {
  id: 'flare-yellow',
  name: 'Flare Yellow',
  description: 'Flare Yellow: curated vivid family theme for the expanded library.',
  category: 'vivid',
  tags: ['vivid', 'expanded', 'curated'] as const,
  collection: 'industry',
  mood: ['bold', 'playful'] as const,
  contrastLevel: 'AA',
  seed: '#ca8a04',
  secondary: '#a16207',
  neutral: 'zinc',
  radius: '0.625rem',
  density: 1,
} satisfies LibraryThemeDefinition;

export default definition;
