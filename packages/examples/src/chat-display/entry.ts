import { defineExample } from '../registry.ts';

export const chatDisplayExample = defineExample({
  id: 'chat-display',
  title: 'Static chat transcript',
  description:
    'User, agent, and system roles with parsed and plain @ text; hostile-looking text remains text in a static transcript.',
  tags: ['chat', 'display', 'messages', 'security', 'a11y'],
  component: 'chat/ChatThreadDisplay',
  props: ['label', 'author', 'role', 'at', 'text'],
  load: () => import('./ChatDisplayDemo.svelte'),
});
