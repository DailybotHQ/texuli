import type { LibraryThemeDefinition } from '../../library-port/types.ts';

const definition = {
  id: 'plasma-pink',
  name: 'Plasma Pink',
  description: 'Plasma Pink: curated vivid family theme for the expanded library.',
  category: 'vivid',
  tags: ['vivid', 'expanded', 'curated'] as const,
  collection: 'industry',
  mood: ['bold', 'playful'] as const,
  contrastLevel: 'AA',
  seed: '#e72e27',
  secondary: '#be123c',
  neutral: 'zinc',
  radius: '0.625rem',
  density: 1,
} satisfies LibraryThemeDefinition;

export default definition;
