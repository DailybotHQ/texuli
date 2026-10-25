import type { LibraryThemeDefinition } from '../../library-port/types.ts';

const definition = {
  id: 'ash-plain',
  name: 'Ash Plain',
  description: 'Ash Plain: curated neutral family theme for the expanded library.',
  category: 'neutral',
  tags: ['neutral', 'expanded', 'curated'] as const,
  collection: 'mono',
  mood: ['minimal'] as const,
  contrastLevel: 'AA',
  seed: '#52525b',
  secondary: '#71717a',
  neutral: 'zinc',
  radius: '0.625rem',
  density: 1,
} satisfies LibraryThemeDefinition;

export default definition;
