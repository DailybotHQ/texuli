import { loadBlogLayout } from 'texuli/layouts/content/blog';
import { loadDocsLayout } from 'texuli/layouts/content/docs';
import { loadEditorialLayout } from 'texuli/layouts/content/editorial';
import { defineExample } from '../registry.ts';

export const docsLayoutExample = defineExample({
  id: 'layout-docs-content',
  title: 'Documentation layout',
  description:
    'Responsive documentation frame with section navigation, a generated table of contents and keyboard-friendly heading anchors.',
  tags: ['layouts', 'docs', 'toc', 'responsive', 'rtl'],
  component: 'texuli/layouts/content/docs',
  props: ['nav', 'options', 'direction'],
  load: async () => {
    await loadDocsLayout();
    return import('./DocsLayoutExample.svelte');
  },
});

export const blogLayoutExample = defineExample({
  id: 'layout-blog-content',
  title: 'Blog layout',
  description:
    'A readable article layout with author metadata, responsive contents navigation and safe in-page links.',
  tags: ['layouts', 'blog', 'toc', 'responsive', 'rtl'],
  component: 'texuli/layouts/content/blog',
  props: ['author', 'date', 'readingTime', 'direction'],
  load: async () => {
    await loadBlogLayout();
    return import('./BlogLayoutExample.svelte');
  },
});

export const editorialLayoutExample = defineExample({
  id: 'layout-editorial-content',
  title: 'Editorial layout',
  description:
    'A long-form editorial frame with an eyebrow, introduction, reading metadata and responsive table of contents.',
  tags: ['layouts', 'editorial', 'toc', 'responsive', 'rtl'],
  component: 'texuli/layouts/content/editorial',
  props: ['eyebrow', 'summary', 'readingTime', 'direction'],
  load: async () => {
    await loadEditorialLayout();
    return import('./EditorialLayoutExample.svelte');
  },
});
