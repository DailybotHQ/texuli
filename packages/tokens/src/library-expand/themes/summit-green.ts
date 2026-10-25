import type { LibraryThemeDefinition } from '../../library-port/types.ts';

const definition = {
  id: 'summit-green',
  name: 'Summit Green',
  description: 'Summit Green: curated brand-like family theme for the expanded library.',
  category: 'brand-like',
  tags: ['brand-like', 'expanded', 'curated'] as const,
  collection: 'brand-like',
  mood: ['corporate', 'bold'] as const,
  contrastLevel: 'AA',
  seed: '#007c68',
  secondary: '#065f46',
  neutral: 'slate',
  radius: '0.625rem',
  density: 1,
} satisfies LibraryThemeDefinition;

export default definition;
