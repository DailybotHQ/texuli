import type { LibraryThemeDefinition } from '../../library-port/types.ts';

const definition = {
  id: 'signal-cyan',
  name: 'Signal Cyan',
  description: 'Signal Cyan: curated vivid family theme for the expanded library.',
  category: 'vivid',
  tags: ['vivid', 'expanded', 'curated'] as const,
  collection: 'industry',
  mood: ['bold', 'playful'] as const,
  contrastLevel: 'AA',
  seed: '#2dacdc',
  secondary: '#0891b2',
  neutral: 'zinc',
  radius: '0.625rem',
  density: 1,
} satisfies LibraryThemeDefinition;

export default definition;
