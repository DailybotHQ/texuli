import type { LibraryThemeDefinition } from '../../library-port/types.ts';

const definition = {
  id: 'spark-blue',
  name: 'Spark Blue',
  description: 'Spark Blue: curated vivid family theme for the expanded library.',
  category: 'vivid',
  tags: ['vivid', 'expanded', 'curated'] as const,
  collection: 'industry',
  mood: ['bold', 'playful'] as const,
  contrastLevel: 'AA',
  seed: '#5352e4',
  secondary: '#1d4ed8',
  neutral: 'zinc',
  radius: '0.625rem',
  density: 1,
} satisfies LibraryThemeDefinition;

export default definition;
