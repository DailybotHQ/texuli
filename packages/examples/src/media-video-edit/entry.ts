import { defineExample } from '../registry.ts';

export const mediaVideoEditExample = defineExample({
  id: 'media-video-edit',
  title: 'Video trim and captions',
  description:
    'Edits a short fictional clip with a trim range and plain-text caption cues; no media is fetched.',
  tags: ['media', 'video', 'captions', 'editing', 'a11y'],
  component: 'media/VideoEditPanel',
  props: ['durationMs', 'value', 'labels', 'onchange'],
  load: () => import('./MediaVideoEditDemo.svelte'),
});
