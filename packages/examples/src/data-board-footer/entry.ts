import { defineExample } from '../registry.ts';

export const dataBoardFooterExample = defineExample({
  id: 'data-board-footer',
  title: 'Board column footers',
  description:
    'A board nested under a page section: column headings start at level 4, and each column ends with a footer snippet that adds a card and shows the count.',
  tags: ['data', 'board', 'headings'],
  component: 'data/board',
  props: ['columnFooter', 'headingLevel'],
  load: () => import('./DataBoardFooterDemo.svelte'),
});
