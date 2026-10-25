import type { LibraryThemeDefinition } from '../../library-port/types.ts';

const definition = {
  id: 'rust-archive',
  name: 'Rust Archive',
  description: 'Rust Archive: curated warm family theme for the expanded library.',
  category: 'warm',
  tags: ['warm', 'expanded', 'curated'] as const,
  collection: 'industry',
  mood: ['warm'] as const,
  contrastLevel: 'AA',
  seed: '#8b4e00',
  secondary: '#7c2d12',
  neutral: 'stone',
  radius: '0.625rem',
  density: 1,
} satisfies LibraryThemeDefinition;

export default definition;
