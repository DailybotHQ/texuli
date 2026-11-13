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

export const editorBlockMenuExample = defineExample({
  id: 'editor-block-menu',
  title: 'Editor block-type menu',
  description:
    'A menu button in the toolbar that sets paragraph, headings, lists, quote or code at the caret in one undoable step.',
  tags: ['editor', 'menu', 'keyboard', 'a11y'],
  component: 'editor/BlockTypeMenu',
  props: ['controller', 'onCommand', 'disabled', 'toolbarItem'],
  load: () => import('./EditorBlockMenuDemo.svelte'),
});

export const editorDialectExportExample = defineExample({
  id: 'editor-dialect-export',
  title: 'Export for chat',
  description:
    'The document written for Slack, Discord, WhatsApp, Telegram, Teams, Google Chat, Mattermost or plain text, with what each format loses listed and broadcast mentions kept as text.',
  tags: ['editor', 'markdown', 'chat', 'export'],
  component: 'editor/DialectExport',
  props: ['controller', 'doc', 'dialect', 'dialects', 'names', 'trust', 'onCopy'],
  load: () => import('./EditorDialectExportDemo.svelte'),
});

export const editorPasteExample = defineExample({
  id: 'editor-paste',
  title: 'Markdown and HTML paste',
  description:
    'Clipboard HTML read without a DOM (scripts, handlers and unsafe links dropped) and plain text kept plain unless pasted as Markdown.',
  tags: ['editor', 'paste', 'markdown', 'url-policy'],
  component: 'editor/RichTextEditor',
  props: ['controller'],
  load: () => import('./EditorPasteDemo.svelte'),
});

export const editorEmojiExample = defineExample({
  id: 'editor-emoji',
  title: 'Editor emoji',
  description:
    'An emoji button in the editor toolbar that opens the emoji picker in a popover, and a :shortcode: input rule, each insertion one undo step.',
  tags: ['editor', 'emoji', 'keyboard', 'a11y'],
  component: 'editor/EditorEmojiButton',
  props: ['controller', 'onCommand', 'recentIds', 'onRecentIdsChange', 'messages', 'artResolver'],
  load: () => import('./EditorEmojiDemo.svelte'),
});
