import type { SolutionHowProps } from '../../shared/types.ts';

export const EDITOR_HOW: Omit<SolutionHowProps, 'entry'> = {
  title: 'From Markdown in to a message out.',
  steps: [
    {
      title: 'Read Markdown',
      body: 'Stored text, agent output or a file is read by the editor codec at the untrusted tier: raw HTML stays literal text, every link passes the URL policy.',
      package: '@texuli/editor',
    },
    {
      title: 'Edit the closed model',
      body: 'Headings, lists, todos, quotes, code and five marks, changed only through transforms; the block menu and emoji are one undo step each.',
      package: '@texuli/core',
    },
    {
      title: 'Paste safely',
      body: 'Clipboard HTML is read without a DOM by the shared HTML reader: scripts, handlers and refused links are dropped before anything reaches the document.',
      package: '@texuli/core',
    },
    {
      title: 'Write it back',
      body: 'Save the document as Markdown that reads back to the same document.',
      package: '@texuli/editor',
    },
    {
      title: 'Send it to a chat',
      body: 'Write Slack, Discord, WhatsApp, Telegram, Teams, Google Chat, Mattermost or plain text, with what each format cannot carry listed for the user.',
      package: '@texuli/core',
    },
  ],
};
