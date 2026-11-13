import type { SolutionEntry } from '../schema.ts';

/** Agent chat: threads that paint validated blueprints (ADR-036). In development as a Solution. */
export const agentChat: SolutionEntry = {
  slug: 'agent-chat',
  name: 'Agent chat',
  status: 'in development',
  tagline: 'A thread whose replies paint validated blueprints.',
  summary:
    'Chat thread, message list and composer on @texuli/chat: replies stream with a Stop control, message Markdown is read by the shared CommonMark parser into safe nodes, the composer autocompletes mentions and slash commands, and replies attach blueprints that are validated before the player paints them. @texuli/chat is on npm; composer autocomplete, stopped replies and ChatAttachment were released in 0.18.0. Emoji render with EmojiText (Unicode); Texuli emoji art is still landing.',
  route: '/solutions/agent-chat/',
  docs: '/guides/solutions/agent-chat/',
  packages: [
    {
      name: '@texuli/chat',
      subpaths: ['.'],
      role: 'Thread, message list, composer, streaming events and the attachment card; on npm, with autocomplete, stopped replies and ChatAttachment released in 0.18.0.',
    },
    {
      name: '@texuli/player',
      subpaths: ['.'],
      role: 'Paints a validated blueprint attachment.',
    },
    {
      name: '@texuli/catalog',
      subpaths: ['./validate'],
      role: 'Validates an attachment against the agent catalog before it paints.',
    },
    {
      name: '@texuli/core',
      subpaths: ['./markdown', './markdown-dialects'],
      role: 'Reads message Markdown into safe nodes and writes a reply in chat dialects (subpaths released in 0.18.0).',
    },
  ],
  capabilities: [
    {
      id: 'thread',
      title: 'Thread',
      summary: 'A message list and composer for people and agents, with streamed replies and Stop.',
      status: 'in development',
    },
    {
      id: 'markdown',
      title: 'Markdown and emoji',
      summary:
        'Message text is read by the shared CommonMark parser into safe nodes, renders emoji with EmojiText (Unicode; Texuli emoji art is still landing) and can be written in chat dialects.',
      status: 'in development',
    },
    {
      id: 'autocomplete',
      title: 'Composer autocomplete',
      summary: 'Mention, slash-command and emoji autocomplete (released in 0.18.0).',
      status: 'in development',
    },
    {
      id: 'blueprints',
      title: 'Blueprint attachments',
      summary:
        'Validate an attached blueprint and paint it with the player, or show why it was refused (released in 0.18.0).',
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
    id: 'agent-chat',
    title: 'Ask the demo agent',
    scenarios: [
      'support-triage',
      'weekly-report',
      'generated-form',
      'refused-attachment',
      'dialect-export',
    ],
    limits: [
      'Fixture replies, no live model and no network: every reply is replayed from the page.',
      'Composer autocomplete, stopped replies and ChatAttachment were released in 0.18.0.',
      'Emoji render as Unicode: Texuli emoji art is still landing.',
    ],
  },
  art: { hero: { slot: 'solution-agent-chat-hero', variant: 'plate' } },
  limits: [
    '@texuli/chat is on npm; composer autocomplete, stopped replies and ChatAttachment were released in 0.18.0, and Texuli emoji art is still landing.',
    'The demo replays fixture replies: there is no live model.',
    'Pre-1.0: a new minor version may break the API.',
  ],
  links: [
    { label: 'Read the docs', href: '/guides/solutions/agent-chat/' },
    { label: '@texuli/chat on npm', href: 'https://www.npmjs.com/package/@texuli/chat' },
  ],
};
