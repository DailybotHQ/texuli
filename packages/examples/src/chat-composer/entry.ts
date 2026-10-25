import { defineExample } from '../registry.ts';

export const chatComposerExample = defineExample({
  id: 'chat-composer',
  title: 'Chat composer and typing indicator',
  description:
    'An autosizing, IME-safe message composer with attachment actions, pending and error feedback, and an announced typing indicator.',
  tags: ['chat', 'composer', 'keyboard', 'a11y'],
  component: 'chat/composer',
  props: ['value', 'onSubmit', 'labels', 'sending', 'attachments', 'names'],
  load: () => import('./ChatComposerDemo.svelte'),
});
