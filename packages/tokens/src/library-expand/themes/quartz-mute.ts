import type { LibraryThemeDefinition } from '../../library-port/types.ts';

const definition = {
  id: 'quartz-mute',
  name: 'Quartz Mute',
  description: 'Quartz Mute: curated neutral family theme for the expanded library.',
  category: 'neutral',
  tags: ['neutral', 'expanded', 'curated'] as const,
  collection: 'mono',
  mood: ['minimal'] as const,
  contrastLevel: 'AA',
  seed: '#826b59',
  secondary: '#57534e',
  neutral: 'zinc',
  radius: '0.625rem',
  density: 1,
} satisfies LibraryThemeDefinition;

export default definition;
