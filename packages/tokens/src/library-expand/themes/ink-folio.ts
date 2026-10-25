import type { LibraryThemeDefinition } from '../../library-port/types.ts';

const definition = {
  id: 'ink-folio',
  name: 'Ink Folio',
  description: 'Ink Folio: curated editorial family theme for the expanded library.',
  category: 'editorial',
  tags: ['editorial', 'expanded', 'curated'] as const,
  collection: 'industry',
  mood: ['editorial', 'luxurious'] as const,
  contrastLevel: 'AA',
  seed: '#382414',
  secondary: '#44403c',
  neutral: 'stone',
  radius: '0.625rem',
  density: 1,
} satisfies LibraryThemeDefinition;

export default definition;
