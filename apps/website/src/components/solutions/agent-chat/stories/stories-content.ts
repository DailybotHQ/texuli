import type { SolutionStoriesProps } from '../../shared/types.ts';

export const AGENT_CHAT_STORIES: Omit<SolutionStoriesProps, 'entry'> = {
  title: 'From a request in the thread to an interface people can use.',
  stories: [
    {
      id: 'stream',
      title: 'Watch the reply arrive, and stop it.',
      body: 'Replies stream into the thread without reading out every token: the finished message is announced once. Stop keeps what was written and marks it as stopped.',
      capabilities: ['thread'],
    },
    {
      id: 'compose',
      title: 'Mention people and run commands from the composer.',
      body: 'Type @ to mention a teammate or / for a command. The list follows the combobox pattern: arrows choose, Enter inserts, Escape closes. Emoji autocomplete arrives with Texuli Emojis.',
      capabilities: ['autocomplete'],
      status: 'in development',
    },
    {
      id: 'attach',
      title: 'Paint only what validates.',
      body: 'A reply can attach a blueprint. The card validates it with the catalog validator first and paints it with the player; one that fails is shown as refused, with the reasons.',
      capabilities: ['blueprints'],
      status: 'in development',
    },
  ],
};
