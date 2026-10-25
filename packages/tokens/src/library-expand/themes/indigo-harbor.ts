import type { LibraryThemeDefinition } from '../../library-port/types.ts';

const definition = {
  id: 'indigo-harbor',
  name: 'Indigo Harbor',
  description: 'Indigo Harbor: curated cool family theme for the expanded library.',
  category: 'cool',
  tags: ['cool', 'expanded', 'curated'] as const,
  collection: 'industry',
  mood: ['calm', 'technical'] as const,
  contrastLevel: 'AA',
  seed: '#4f46e5',
  secondary: '#4338ca',
  neutral: 'slate',
  radius: '0.625rem',
  density: 1,
} satisfies LibraryThemeDefinition;

export default definition;
