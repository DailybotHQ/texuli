import type { SolutionEntry } from '../schema.ts';

/** Agent chat: threads that paint validated blueprints (ADR-036). In development as a Solution. */
export const agentChat: SolutionEntry = {
  slug: 'agent-chat',
  name: 'Agent chat',
  status: 'in development',
  tagline: 'A thread whose replies paint validated blueprints.',
  summary:
    'Chat thread, message list and composer on @texuli/chat, with Markdown, emoji and dialect export still landing. Replies attach validated blueprints painted by the player. @texuli/chat is on npm; this Solution is not complete until those extras ship.',
  route: '/solutions/agent-chat/',
  docs: '/guides/solutions/agent-chat/',
  packages: [
    {
      name: '@texuli/chat',
      subpaths: ['.'],
      role: 'Thread, message list, composer and typing indicator',
    },
  ],
  capabilities: [
    {
      id: 'thread',
      title: 'Thread',
      summary: 'A message list and composer for people and agents.',
      status: 'in development',
    },
    {
      id: 'markdown',
      title: 'Markdown and emoji',
      summary: 'Render messages through @texuli/markdown with Texuli emoji. Still landing.',
      status: 'in development',
    },
    {
      id: 'autocomplete',
      title: 'Composer autocomplete',
      summary: 'Emoji, mention and slash-command autocomplete. Still landing.',
      status: 'in development',
    },
    {
      id: 'blueprints',
      title: 'Blueprint attachments',
      summary: 'Paint a validated blueprint in the thread via the player. Still landing.',
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
    title: 'Ask for a dashboard',
    scenarios: ['blueprint-reply'],
    limits: ['Placeholder until the Agent chat landing demo ships. Fixture-driven, no network.'],
  },
  art: { hero: { slot: 'solution-agent-chat-hero', variant: 'plate' } },
  limits: [
    '@texuli/chat is on npm; the Agent chat Solution is still in development (Markdown, emoji, autocomplete, streaming polish and blueprint attachments).',
    'Pre-1.0: a new minor version may break the API.',
  ],
  links: [
    { label: 'Read the docs', href: '/guides/solutions/agent-chat/' },
    { label: '@texuli/chat on npm', href: 'https://www.npmjs.com/package/@texuli/chat' },
  ],
};
