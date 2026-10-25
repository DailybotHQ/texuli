import { defineExample } from '../registry.ts';

export const editorBasicExample = defineExample({
  id: 'editor-basic',
  title: 'Rich text editor',
  description:
    'A labelled multiline textbox over the closed editor model: headings, marks, lists, todos, quotes and code rendered as real elements, with Markdown in and out.',
  tags: ['editor', 'rich-text', 'keyboard', 'a11y'],
  component: 'editor/RichTextEditor',
  props: ['value', 'onChange', 'label', 'placeholder', 'readonly', 'toolbar'],
  load: () => import('./EditorBasicDemo.svelte'),
});

export const editorToolbarExample = defineExample({
  id: 'editor-toolbar',
  title: 'Editor with toolbar and links',
  description:
    'The roving formatting toolbar with pressed states and shortcuts, the link dialog that refuses unsafe addresses visibly, and the Markdown the document saves as.',
  tags: ['editor', 'toolbar', 'url-policy', 'keyboard'],
  component: 'editor/EditorToolbar',
  props: ['controller', 'onCommand', 'onLinkRequest', 'trust'],
  load: () => import('./EditorToolbarDemo.svelte'),
});

export const editorLongDocumentExample = defineExample({
  id: 'editor-long-document',
  title: 'Long document editing',
  description:
    'Four hundred blocks rendered in full and keyed by id, with off-screen blocks skipping layout and paint through content-visibility.',
  tags: ['editor', 'performance', 'long-document'],
  component: 'editor/RichTextEditor',
  props: ['value', 'onChange', 'label'],
  load: () => import('./EditorLongDocumentDemo.svelte'),
});
