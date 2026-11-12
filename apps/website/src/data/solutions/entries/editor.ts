import type { SolutionEntry } from '../schema.ts';

/** Rich text editor (ADR-036). @texuli/editor is in development, on npm. */
export const editor: SolutionEntry = {
  slug: 'editor',
  name: 'Rich text editor',
  status: 'in development',
  tagline: 'Owned rich text with Markdown in and out, safe paste and export to any chat.',
  summary:
    'A Svelte 5 editor on the ADR-003 model: a closed vocabulary, a Markdown codec that reads untrusted text and writes it back, and a toolbar. @texuli/editor is on npm; HTML paste through the shared DOM-free reader, Paste as Markdown, the block-type menu, the emoji button and the export to chat dialects were added after 0.17.4 and are not in a published release yet.',
  route: '/solutions/editor/',
  docs: '/guides/solutions/editor/',
  packages: [
    {
      name: '@texuli/editor',
      subpaths: [
        '.',
        './editor',
        './markdown',
        './paste',
        './toolbar',
        './block-menu',
        './emoji',
        './export',
      ],
      role: 'Editor surface, toolbar, controller, Markdown codec and paste; on npm, with the block menu, emoji, chat export and HTML paste through @texuli/core/html added after 0.17.4 (not in a published release yet).',
    },
    {
      name: '@texuli/core',
      subpaths: ['./editor-model', './editor-markdown', './html', './markdown-dialects'],
      role: 'Framework-free document model and Markdown codec; the HTML reader and chat dialect writers (subpaths added after 0.17.4, not in a published release yet).',
    },
    {
      name: 'texuli',
      subpaths: ['./emoji'],
      role: 'The emoji picker the editor opens (added after 0.17.4, not in a published release yet).',
    },
  ],
  capabilities: [
    {
      id: 'edit',
      title: 'Edit',
      summary:
        'Type, select and format in the closed editor vocabulary; set block types from a menu.',
      status: 'in development',
    },
    {
      id: 'markdown',
      title: 'Markdown',
      summary: 'Load untrusted Markdown and save it back to the same document. No HTML sinks.',
      status: 'in development',
    },
    {
      id: 'paste',
      title: 'Safe paste',
      summary:
        'Clipboard HTML read without a DOM: scripts, handlers and refused links dropped. Plain text stays plain unless pasted as Markdown (added after 0.17.4, not in a published release yet).',
      status: 'in development',
    },
    {
      id: 'emoji',
      title: 'Emoji',
      summary:
        'An emoji button with the picker in a popover and a :shortcode: input rule, each one undo step (added after 0.17.4, not in a published release yet).',
      status: 'in development',
    },
    {
      id: 'dialects',
      title: 'Chat dialect export',
      summary:
        'Export to Slack, Discord, WhatsApp, Telegram, Teams, Google Chat, Mattermost or plain text, with the losses listed and broadcast mentions off (added after 0.17.4, not in a published release yet).',
      status: 'in development',
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
    title: 'Write, paste and send',
    scenarios: ['release-notes', 'support-macro', 'meeting-note'],
    limits: [
      'Fixture documents only: nothing is saved, and the export is copied, never sent.',
      'HTML paste through @texuli/core/html, Paste as Markdown, the block menu, emoji and chat export were added after 0.17.4 and are not in a published release yet.',
      'Emoji show as Unicode: Texuli emoji art is still landing.',
    ],
  },
  art: { hero: { slot: 'solution-editor-hero', variant: 'plate' } },
  limits: [
    '@texuli/editor is on npm (pre-1.0: a new minor version may break the API); HTML paste through @texuli/core/html, Paste as Markdown, the block menu, emoji and chat export were added after 0.17.4 and are not in a published release yet.',
    'The editor ships no emoji data: the :shortcode: rule uses a lookup the host passes.',
    '/editor-page/ stays as the capability reference; it is not redirected (ADR-036).',
  ],
  links: [
    { label: 'Read the docs', href: '/guides/solutions/editor/' },
    { label: 'Capability page (reference)', href: '/editor-page/' },
    { label: '@texuli/editor on npm', href: 'https://www.npmjs.com/package/@texuli/editor' },
  ],
};
