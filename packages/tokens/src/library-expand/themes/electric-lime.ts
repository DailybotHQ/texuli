import type { LibraryThemeDefinition } from '../../library-port/types.ts';

const definition = {
  id: 'electric-lime',
  name: 'Electric Lime',
  description: 'Electric Lime: curated vivid family theme for the expanded library.',
  category: 'vivid',
  tags: ['vivid', 'expanded', 'curated'] as const,
  collection: 'industry',
  mood: ['bold', 'playful'] as const,
  contrastLevel: 'AA',
  seed: '#65a30d',
  secondary: '#4d7c0f',
  neutral: 'zinc',
  radius: '0.625rem',
  density: 1,
} satisfies LibraryThemeDefinition;

export default definition;
