import type { LibraryThemeDefinition } from '../../library-port/types.ts';

const definition = {
  id: 'cloud-ledger',
  name: 'Cloud Ledger',
  description: 'Cloud Ledger: curated neutral family theme for the expanded library.',
  category: 'neutral',
  tags: ['neutral', 'expanded', 'curated'] as const,
  collection: 'mono',
  mood: ['minimal'] as const,
  contrastLevel: 'AA',
  seed: '#64748b',
  secondary: '#475569',
  neutral: 'zinc',
  radius: '0.625rem',
  density: 1,
} satisfies LibraryThemeDefinition;

export default definition;
