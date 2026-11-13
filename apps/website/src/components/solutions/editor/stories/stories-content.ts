import type { SolutionStoriesProps } from '../../shared/types.ts';

export const EDITOR_STORIES: Omit<SolutionStoriesProps, 'entry'> = {
  title: 'Write once, keep the Markdown, send it anywhere.',
  stories: [
    {
      id: 'markdown',
      title: 'Load and save Markdown without losing the document.',
      body: 'Release notes, support macros and meeting notes load from Markdown and save back to the same Markdown. Raw HTML in the source stays literal text, and a link the URL policy refuses keeps its text.',
      capabilities: ['edit', 'markdown'],
    },
    {
      id: 'paste',
      title: 'Paste from any page, safely.',
      body: 'Copy a section of a web page and paste it: headings, lists, marks and safe links arrive; scripts, click handlers and javascript: links do not. Plain text stays plain unless you choose Paste as Markdown.',
      capabilities: ['paste'],
      status: 'in development',
    },
    {
      id: 'export',
      title: 'Send the same note to every chat.',
      body: 'Export the document for Slack, Discord, WhatsApp, Telegram, Teams, Google Chat, Mattermost or plain text. Each format lists what it cannot carry, and @everyone or @here never becomes a ping.',
      capabilities: ['dialects'],
      status: 'in development',
    },
  ],
};
