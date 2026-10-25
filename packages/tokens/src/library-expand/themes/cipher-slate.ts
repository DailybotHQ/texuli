import type { LibraryThemeDefinition } from '../../library-port/types.ts';

const definition = {
  id: 'cipher-slate',
  name: 'Cipher Slate',
  description: 'Cipher Slate: curated brand-like family theme for the expanded library.',
  category: 'brand-like',
  tags: ['brand-like', 'expanded', 'curated'] as const,
  collection: 'brand-like',
  mood: ['corporate', 'bold'] as const,
  contrastLevel: 'AA',
  seed: '#334155',
  secondary: '#1e293b',
  neutral: 'slate',
  radius: '0.625rem',
  density: 1,
} satisfies LibraryThemeDefinition;

export default definition;
