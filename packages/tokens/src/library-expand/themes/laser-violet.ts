import type { LibraryThemeDefinition } from '../../library-port/types.ts';

const definition = {
  id: 'laser-violet',
  name: 'Laser Violet',
  description: 'Laser Violet: curated vivid family theme for the expanded library.',
  category: 'vivid',
  tags: ['vivid', 'expanded', 'curated'] as const,
  collection: 'industry',
  mood: ['bold', 'playful'] as const,
  contrastLevel: 'AA',
  seed: '#8a42da',
  secondary: '#6d28d9',
  neutral: 'zinc',
  radius: '0.625rem',
  density: 1,
} satisfies LibraryThemeDefinition;

export default definition;
