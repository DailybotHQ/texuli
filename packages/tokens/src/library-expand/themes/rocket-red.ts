import type { LibraryThemeDefinition } from '../../library-port/types.ts';

const definition = {
  id: 'rocket-red',
  name: 'Rocket Red',
  description: 'Rocket Red: curated vivid family theme for the expanded library.',
  category: 'vivid',
  tags: ['vivid', 'expanded', 'curated'] as const,
  collection: 'industry',
  mood: ['bold', 'playful'] as const,
  contrastLevel: 'AA',
  seed: '#d93900',
  secondary: '#b91c1c',
  neutral: 'zinc',
  radius: '0.625rem',
  density: 1,
} satisfies LibraryThemeDefinition;

export default definition;
