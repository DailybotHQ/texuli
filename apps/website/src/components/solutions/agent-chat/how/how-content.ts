import type { SolutionHowProps } from '../../shared/types.ts';

export const AGENT_CHAT_HOW: Omit<SolutionHowProps, 'entry'> = {
  title: 'From a streamed reply to a painted blueprint.',
  steps: [
    {
      title: 'Stream the reply',
      body: 'Apply start, delta and end events to the message list. Plain text only; Stop ends the stream and keeps the partial text.',
      package: '@texuli/chat',
    },
    {
      title: 'Read the Markdown',
      body: 'Message text is read by the shared CommonMark parser and filtered to safe nodes: no HTML, links through the untrusted URL policy.',
      package: '@texuli/core',
    },
    {
      title: 'Validate the attachment',
      body: 'Check an attached blueprint against the agent catalog at the untrusted tier before anything paints.',
      package: '@texuli/catalog',
    },
    {
      title: 'Paint it',
      body: 'Hand the validated value to the player; a refused one shows its reasons instead.',
      package: '@texuli/player',
    },
    {
      title: 'Share it elsewhere',
      body: 'Write a reply in another chat dialect (Slack, Discord, Teams, WhatsApp) and see what had to be adapted.',
      package: '@texuli/core',
    },
  ],
};
