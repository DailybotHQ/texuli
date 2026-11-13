import type {
  SolutionAgentsProps,
  SolutionNextStepsProps,
  SolutionPlatformsProps,
  SolutionRecipesProps,
} from '../../shared/types.ts';

export const AGENT_CHAT_RECIPES: Omit<SolutionRecipesProps, 'entry'> = {
  title: 'Keep building',
  recipes: [
    {
      title: 'Build an agent thread',
      summary: 'Stream replies, add composer autocomplete and attach validated blueprints.',
      href: '/guides/solutions/agent-chat/',
    },
    {
      title: 'See the thread example',
      summary: 'The package example with grouping, streaming and the reading position.',
      href: '/examples/chat-thread/',
    },
  ],
};

export const AGENT_CHAT_AGENTS: Omit<SolutionAgentsProps, 'entry'> = {
  title: 'For agents',
  body: 'An agent writes plain text and blueprints. The host validates every blueprint against the catalog before it paints, and message text never becomes HTML. This demo replays fixtures; it calls no model.',
  surfaces: [
    {
      label: '@texuli/chat',
      detail: 'Thread, message list, composer and streaming events; published on npm.',
      status: 'in development',
    },
    {
      label: 'Composer autocomplete, stopped replies and ChatAttachment',
      detail: 'Released in 0.18.0 (pre-1.0).',
      status: 'planned',
    },
  ],
};

export const AGENT_CHAT_PLATFORMS: Omit<SolutionPlatformsProps, 'entry'> = {
  title: 'Platforms',
};

export const AGENT_CHAT_NEXT: Omit<SolutionNextStepsProps, 'entry'> = {
  links: [
    { label: 'Build an agent thread', href: '/guides/solutions/agent-chat/' },
    { label: 'Chat thread example', href: '/examples/chat-thread/' },
    { label: '@texuli/chat on npm', href: 'https://www.npmjs.com/package/@texuli/chat' },
  ],
};
