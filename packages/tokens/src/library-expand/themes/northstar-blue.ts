import type { LibraryThemeDefinition } from '../../library-port/types.ts';

const definition = {
  id: 'northstar-blue',
  name: 'Northstar Blue',
  description: 'Northstar Blue: curated brand-like family theme for the expanded library.',
  category: 'brand-like',
  tags: ['brand-like', 'expanded', 'curated'] as const,
  collection: 'brand-like',
  mood: ['corporate', 'bold'] as const,
  contrastLevel: 'AA',
  seed: '#513cd2',
  secondary: '#1e40af',
  neutral: 'slate',
  radius: '0.625rem',
  density: 1,
} satisfies LibraryThemeDefinition;

export default definition;
