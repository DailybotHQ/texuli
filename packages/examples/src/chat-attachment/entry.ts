import { defineExample } from '../registry.ts';

export const chatAttachmentExample = defineExample({
  id: 'chat-attachment',
  title: 'Chat blueprint attachment',
  description:
    'A message card that validates an attached blueprint with the catalog validator and paints it with the player behind a disclosure, and a refused card that lists why it was not painted.',
  tags: ['chat', 'attachment', 'player', 'a11y'],
  component: 'chat/attachment',
  props: ['artifact', 'title', 'check', 'preview', 'open', 'labels'],
  load: () => import('./ChatAttachmentDemo.svelte'),
});
