import { defineExample } from '../registry.ts';

export const texuliEmojiExample = defineExample({
  id: 'texuli-emoji-picker',
  title: 'Emoji picker and text',
  description:
    'Search and select Unicode emoji with keyboard navigation, category tabs and host-controlled recents.',
  tags: ['texuli', 'emoji', 'a11y'],
  component: 'texuli/EmojiPicker',
  props: ['label', 'recentIds', 'onRecentIdsChange', 'onSelect'],
  load: () => import('./EmojiDemo.svelte'),
});
