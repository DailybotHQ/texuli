import type { LibraryThemeDefinition } from '../../library-port/types.ts';

const definition = {
  id: 'slate-masthead',
  name: 'Slate Masthead',
  description: 'Slate Masthead: curated editorial family theme for the expanded library.',
  category: 'editorial',
  tags: ['editorial', 'expanded', 'curated'] as const,
  collection: 'industry',
  mood: ['editorial', 'luxurious'] as const,
  contrastLevel: 'AA',
  seed: '#2b243a',
  secondary: '#1e293b',
  neutral: 'stone',
  radius: '0.625rem',
  density: 1,
} satisfies LibraryThemeDefinition;

export default definition;
