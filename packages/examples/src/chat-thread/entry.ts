import { defineExample } from '../registry.ts';

export const chatThreadExample = defineExample({
  id: 'chat-thread',
  title: 'Chat thread and message list',
  description:
    'Grouped messages, safe inline formatting, timestamps, own-message alignment, and a long virtualized history with fictional people.',
  tags: ['chat', 'thread', 'messages', 'virtualization', 'a11y'],
  component: 'chat/thread',
  props: ['messages', 'currentUserId', 'typing', 'draft', 'onSend', 'locale'],
  load: () => import('./ChatThreadDemo.svelte'),
});
