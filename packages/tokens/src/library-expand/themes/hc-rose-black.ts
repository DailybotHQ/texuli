import type { LibraryThemeDefinition } from '../../library-port/types.ts';

const definition = {
  id: 'hc-rose-black',
  name: 'HC Rose Black',
  description: 'HC Rose Black: curated high-contrast family theme for the expanded library.',
  category: 'high-contrast',
  tags: ['high-contrast', 'expanded', 'curated'] as const,
  collection: 'high-contrast',
  mood: ['minimal'] as const,
  contrastLevel: 'AAA',
  seed: '#b54000',
  secondary: '#4c0519',
  neutral: 'zinc',
  radius: '0.625rem',
  density: 1,
} satisfies LibraryThemeDefinition;

export default definition;
