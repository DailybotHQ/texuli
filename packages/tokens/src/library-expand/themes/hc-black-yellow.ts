import type { LibraryThemeDefinition } from '../../library-port/types.ts';

const definition = {
  id: 'hc-black-yellow',
  name: 'HC Black Yellow',
  description: 'HC Black Yellow: curated high-contrast family theme for the expanded library.',
  category: 'high-contrast',
  tags: ['high-contrast', 'expanded', 'curated'] as const,
  collection: 'high-contrast',
  mood: ['minimal'] as const,
  contrastLevel: 'AAA',
  seed: '#09090b',
  secondary: '#facc15',
  neutral: 'zinc',
  radius: '0.625rem',
  density: 1,
} satisfies LibraryThemeDefinition;

export default definition;
