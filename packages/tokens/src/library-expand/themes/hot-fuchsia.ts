import type { LibraryThemeDefinition } from '../../library-port/types.ts';

const definition = {
  id: 'hot-fuchsia',
  name: 'Hot Fuchsia',
  description: 'Hot Fuchsia: curated vivid family theme for the expanded library.',
  category: 'vivid',
  tags: ['vivid', 'expanded', 'curated'] as const,
  collection: 'industry',
  mood: ['bold', 'playful'] as const,
  contrastLevel: 'AA',
  seed: '#de256a',
  secondary: '#be185d',
  neutral: 'zinc',
  radius: '0.625rem',
  density: 1,
} satisfies LibraryThemeDefinition;

export default definition;
