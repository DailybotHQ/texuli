import type { LibraryThemeDefinition } from '../../library-port/types.ts';

const definition = {
  id: 'ember-lounge',
  name: 'Ember Lounge',
  description: 'Ember Lounge: curated warm family theme for the expanded library.',
  category: 'warm',
  tags: ['warm', 'expanded', 'curated'] as const,
  collection: 'industry',
  mood: ['warm'] as const,
  contrastLevel: 'AA',
  seed: '#d92414',
  secondary: '#b91c1c',
  neutral: 'stone',
  radius: '0.625rem',
  density: 1,
} satisfies LibraryThemeDefinition;

export default definition;
