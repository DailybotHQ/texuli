import type { LibraryThemeDefinition } from '../../library-port/types.ts';

const definition = {
  id: 'volt-green',
  name: 'Volt Green',
  description: 'Volt Green: curated vivid family theme for the expanded library.',
  category: 'vivid',
  tags: ['vivid', 'expanded', 'curated'] as const,
  collection: 'industry',
  mood: ['bold', 'playful'] as const,
  contrastLevel: 'AA',
  seed: '#00a76e',
  secondary: '#15803d',
  neutral: 'zinc',
  radius: '0.625rem',
  density: 1,
} satisfies LibraryThemeDefinition;

export default definition;
