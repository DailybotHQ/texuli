import type { LibraryThemeDefinition } from '../../library-port/types.ts';

const definition = {
  id: 'chroma-teal',
  name: 'Chroma Teal',
  description: 'Chroma Teal: curated vivid family theme for the expanded library.',
  category: 'vivid',
  tags: ['vivid', 'expanded', 'curated'] as const,
  collection: 'industry',
  mood: ['bold', 'playful'] as const,
  contrastLevel: 'AA',
  seed: '#0f766e',
  secondary: '#115e59',
  neutral: 'zinc',
  radius: '0.625rem',
  density: 1,
} satisfies LibraryThemeDefinition;

export default definition;
