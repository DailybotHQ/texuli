import type { LibraryThemeDefinition } from '../../library-port/types.ts';

const definition = {
  id: 'ledger-teal',
  name: 'Ledger Teal',
  description: 'Ledger Teal: curated brand-like family theme for the expanded library.',
  category: 'brand-like',
  tags: ['brand-like', 'expanded', 'curated'] as const,
  collection: 'brand-like',
  mood: ['corporate', 'bold'] as const,
  contrastLevel: 'AA',
  seed: '#007075',
  secondary: '#115e59',
  neutral: 'slate',
  radius: '0.625rem',
  density: 1,
} satisfies LibraryThemeDefinition;

export default definition;
