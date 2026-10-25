import { defineExample } from '../registry.ts';

export const blocksInteractiveExample = defineExample({
  id: 'blocks-interactive',
  title: 'Interactive blocks',
  description:
    'Poll, quiz, calculator and checklist blocks from validated data. Fictional Harbor Notes copy only.',
  tags: ['blocks', 'interactive', 'poll', 'quiz', 'a11y', 'rtl', 'dark'],
  component: 'blocks/interactive',
  props: ['block'],
  load: () => import('./BlocksInteractiveDemo.svelte'),
});
