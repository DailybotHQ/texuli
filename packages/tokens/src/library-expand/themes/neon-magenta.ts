import type { LibraryThemeDefinition } from '../../library-port/types.ts';

const definition = {
  id: 'neon-magenta',
  name: 'Neon Magenta',
  description: 'Neon Magenta: curated vivid family theme for the expanded library.',
  category: 'vivid',
  tags: ['vivid', 'expanded', 'curated'] as const,
  collection: 'industry',
  mood: ['bold', 'playful'] as const,
  contrastLevel: 'AA',
  seed: '#c026d3',
  secondary: '#a21caf',
  neutral: 'zinc',
  radius: '0.625rem',
  density: 1,
} satisfies LibraryThemeDefinition;

export default definition;
