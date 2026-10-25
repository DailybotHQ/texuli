import type { LibraryThemeDefinition } from '../../library-port/types.ts';

const definition = {
  id: 'smoke-frame',
  name: 'Smoke Frame',
  description: 'Smoke Frame: curated neutral family theme for the expanded library.',
  category: 'neutral',
  tags: ['neutral', 'expanded', 'curated'] as const,
  collection: 'mono',
  mood: ['minimal'] as const,
  contrastLevel: 'AA',
  seed: '#98a4be',
  secondary: '#64748b',
  neutral: 'zinc',
  radius: '0.625rem',
  density: 1,
} satisfies LibraryThemeDefinition;

export default definition;
