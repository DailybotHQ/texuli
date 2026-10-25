import { defineExample } from '../registry.ts';

const component = 'media/ImageEditor';

export const mediaImageEditorExamples = [
  defineExample({
    id: 'media-image-editor',
    title: 'Image editor',
    description:
      'Crop, rotate, flip, resize, adjust and annotate a fictional harbor photo without changing it, then export the result.',
    tags: ['media', 'image', 'editor', 'keyboard'],
    component,
    props: ['src', 'alt', 'trust', 'value', 'onexport'],
    load: () => import('./ImageEditorDemo.svelte'),
  }),
  defineExample({
    id: 'media-image-editor-edited',
    title: 'Image editor with a saved edit',
    description:
      'Opens a validated saved edit: a crop, three adjustments, an ellipse, an arrow and a text label over the photo.',
    tags: ['media', 'image', 'editor', 'annotations'],
    component,
    props: ['value', 'onexport'],
    load: () => import('./ImageEditorEditedDemo.svelte'),
  }),
  defineExample({
    id: 'media-image-editor-blocked',
    title: 'Image editor refusing an unsafe source',
    description:
      'An untrusted HTTP source fails the media URL policy: the editor shows a note and never requests the image.',
    tags: ['media', 'image', 'editor', 'safety'],
    component,
    props: ['src', 'trust'],
    load: () => import('./ImageEditorBlockedDemo.svelte'),
  }),
] as const;
