import type { LibraryThemeDefinition } from '../../library-port/types.ts';

const definition = {
  id: 'brick-lane',
  name: 'Brick Lane',
  description: 'Brick Lane: curated warm family theme for the expanded library.',
  category: 'warm',
  tags: ['warm', 'expanded', 'curated'] as const,
  collection: 'industry',
  mood: ['warm'] as const,
  contrastLevel: 'AA',
  seed: '#b62f00',
  secondary: '#991b1b',
  neutral: 'stone',
  radius: '0.625rem',
  density: 1,
} satisfies LibraryThemeDefinition;

export default definition;
