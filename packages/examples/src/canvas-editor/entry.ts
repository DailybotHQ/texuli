import { defineExample } from '../registry.ts';

export const canvasEditorExample = defineExample({
  id: 'canvas-editor',
  title: 'Infinite canvas',
  description:
    'A launch retro on the infinite canvas: sticky notes in a frame and a decision flow. Tab through shapes, move with arrows, resize with Shift, connect with K, zoom and undo.',
  tags: ['canvas', 'whiteboard', 'keyboard', 'diagram'],
  component: 'canvas/CanvasEditor',
  props: ['canvas', 'sync', 'readonly', 'resolveImage', 'snap', 'labels', 'onchange'],
  load: () => import('./CanvasEditorDemo.svelte'),
});
