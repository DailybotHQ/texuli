import type { SolutionEntry } from '../schema.ts';

/** Rich text editor (ADR-036). @texuli/editor is in development. */
export const editor: SolutionEntry = {
  slug: 'editor',
  name: 'Rich text editor',
  status: 'in development',
  tagline: 'Owned rich text with Markdown in and out.',
  summary:
    'A Svelte 5 editor on the ADR-003 model: closed marks, Markdown codec, HTML paste as an allowlisted tokenizer. Emoji, Markdown paste as a command, dialect export and a block menu are still landing. @texuli/editor is in development on npm.',
  route: '/solutions/editor/',
  docs: '/guides/solutions/editor/',
  packages: [
    {
      name: '@texuli/editor',
      subpaths: ['.', './editor', './markdown', './paste', './toolbar'],
      role: 'Editor surface, Markdown codec, paste tokenizer and toolbar — in development on npm',
    },
    {
      name: '@texuli/core',
      subpaths: ['./editor-model', './editor-markdown'],
      role: 'Framework-free document model and Markdown subset',
    },
  ],
  capabilities: [
    {
      id: 'edit',
      title: 'Edit',
      summary: 'Type, select and format in the closed editor vocabulary.',
      status: 'in development',
    },
    {
      id: 'markdown',
      title: 'Markdown',
      summary: 'Load and save the closed Markdown subset. No HTML sinks.',
      status: 'in development',
    },
    {
      id: 'paste',
      title: 'HTML paste',
      summary: 'Clipboard HTML goes through an owned tokenizer, then the untrusted loader.',
      status: 'in development',
    },
    {
      id: 'dialects',
      title: 'Chat dialect export',
      summary: 'Export to Slack, Discord, Telegram and the other dialects. Planned.',
      status: 'planned',
    },
  ],
  platforms: [
    { platform: 'web', status: 'in development', evidence: [] },
    { platform: 'compose-desktop', status: 'planned', evidence: [] },
    { platform: 'android', status: 'planned', evidence: [] },
    { platform: 'ios', status: 'planned', evidence: [] },
  ],
  demo: {
    id: 'editor',
    title: 'Write a release note',
    scenarios: ['release-note'],
    limits: ['Placeholder until the editor landing demo ships. Nothing is saved.'],
  },
  art: { hero: { slot: 'solution-editor-hero', variant: 'plate' } },
  limits: [
    '@texuli/editor is in development (pre-1.0): a new minor version may break the API.',
    'Emoji picker, Markdown-as-paste command, dialect export and a block menu are not shipped yet.',
    '/editor-page/ stays as the capability reference; it is not redirected (ADR-036).',
  ],
  links: [
    { label: 'Read the docs', href: '/guides/solutions/editor/' },
    { label: 'Capability page (reference)', href: '/editor-page/' },
    { label: '@texuli/editor on npm', href: 'https://www.npmjs.com/package/@texuli/editor' },
  ],
};
