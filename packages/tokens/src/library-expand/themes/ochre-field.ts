import type { LibraryThemeDefinition } from '../../library-port/types.ts';

const definition = {
  id: 'ochre-field',
  name: 'Ochre Field',
  description: 'Ochre Field: curated warm family theme for the expanded library.',
  category: 'warm',
  tags: ['warm', 'expanded', 'curated'] as const,
  collection: 'industry',
  mood: ['warm'] as const,
  contrastLevel: 'AA',
  seed: '#846c00',
  secondary: '#ca8a04',
  neutral: 'stone',
  radius: '0.625rem',
  density: 1,
} satisfies LibraryThemeDefinition;

export default definition;
