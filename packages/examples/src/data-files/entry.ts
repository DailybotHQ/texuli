import { defineExample } from '../registry.ts';

export const dataFilesExample = defineExample({
  id: 'data-files',
  title: 'File browser',
  description:
    'Grid and list file browser with breadcrumbs, multi-select, side preview and keyboard navigation on a fictional workspace library.',
  tags: ['data', 'files', 'browser', 'keyboard', 'rtl'],
  component: 'data/files',
  props: ['entries', 'folderId', 'selected', 'layout', 'getPreviewSrc'],
  load: () => import('./FileBrowserDemo.svelte'),
});
