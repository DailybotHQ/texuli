import { defineExample } from '../registry.ts';

export const canvasViewerExample = defineExample({
  id: 'canvas-viewer',
  title: 'Canvas viewer',
  description:
    'A read-only canvas fitted into an SVG image, with every shape and connector listed in reading order for screen readers. No editing code.',
  tags: ['canvas', 'read-only', 'diagram'],
  component: 'canvas/CanvasViewer',
  props: ['canvas', 'label', 'resolveImage', 'trust', 'dir'],
  load: () => import('./CanvasViewerDemo.svelte'),
});
