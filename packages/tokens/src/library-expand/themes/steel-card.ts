import type { LibraryThemeDefinition } from '../../library-port/types.ts';

const definition = {
  id: 'steel-card',
  name: 'Steel Card',
  description: 'Steel Card: curated neutral family theme for the expanded library.',
  category: 'neutral',
  tags: ['neutral', 'expanded', 'curated'] as const,
  collection: 'mono',
  mood: ['minimal'] as const,
  contrastLevel: 'AA',
  seed: '#71717a',
  secondary: '#3f3f46',
  neutral: 'zinc',
  radius: '0.625rem',
  density: 1,
} satisfies LibraryThemeDefinition;

export default definition;
