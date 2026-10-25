import type { LibraryThemeDefinition } from '../../library-port/types.ts';

const definition = {
  id: 'moss-path',
  name: 'Moss Path',
  description: 'Moss Path: curated earthy family theme for the expanded library.',
  category: 'earthy',
  tags: ['earthy', 'expanded', 'curated'] as const,
  collection: 'industry',
  mood: ['warm', 'editorial'] as const,
  contrastLevel: 'AA',
  seed: '#3f6212',
  secondary: '#365314',
  neutral: 'stone',
  radius: '0.625rem',
  density: 1,
} satisfies LibraryThemeDefinition;

export default definition;
