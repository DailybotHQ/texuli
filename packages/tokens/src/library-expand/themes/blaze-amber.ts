import type { LibraryThemeDefinition } from '../../library-port/types.ts';

const definition = {
  id: 'blaze-amber',
  name: 'Blaze Amber',
  description: 'Blaze Amber: curated vivid family theme for the expanded library.',
  category: 'vivid',
  tags: ['vivid', 'expanded', 'curated'] as const,
  collection: 'industry',
  mood: ['bold', 'playful'] as const,
  contrastLevel: 'AA',
  seed: '#d97706',
  secondary: '#b45309',
  neutral: 'zinc',
  radius: '0.625rem',
  density: 1,
} satisfies LibraryThemeDefinition;

export default definition;
