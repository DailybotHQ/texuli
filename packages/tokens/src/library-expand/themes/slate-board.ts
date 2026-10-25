import type { LibraryThemeDefinition } from '../../library-port/types.ts';

const definition = {
  id: 'slate-board',
  name: 'Slate Board',
  description: 'Slate Board: curated neutral family theme for the expanded library.',
  category: 'neutral',
  tags: ['neutral', 'expanded', 'curated'] as const,
  collection: 'mono',
  mood: ['minimal'] as const,
  contrastLevel: 'AA',
  seed: '#41425a',
  secondary: '#1e293b',
  neutral: 'zinc',
  radius: '0.625rem',
  density: 1,
} satisfies LibraryThemeDefinition;

export default definition;
