import { defineExample } from '../registry.ts';

export const texuliFileUploadExample = defineExample({
  id: 'texuli-file-upload',
  title: 'File upload',
  description:
    'Styled drop zone with file list, image previews, progress and rejection errors. Fictional Harbor Notes copy; no real network upload.',
  tags: ['texuli', 'file-upload', 'a11y', 'rtl', 'dark'],
  component: 'texuli/FileUpload',
  props: ['accept', 'maxSize', 'maxFiles', 'variant', 'progress', 'disabled'],
  load: () => import('./FileUploadDemo.svelte'),
});
