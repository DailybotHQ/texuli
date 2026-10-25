import { defineExample } from '../registry.ts';

/** Captions and chapters example (T-media-captions). */
export const mediaCaptionsExample = defineExample({
  id: 'media-captions',
  title: 'Captions and chapters',
  description:
    'WebVTT captions with a chapter menu, transcript seek, active caption line, and a blocked unsafe track. Fictional harbor tour copy only.',
  tags: ['media', 'captions', 'chapters', 'transcript', 'security', 'a11y', 'keyboard', 'dark'],
  component: 'media/CaptionsPanel',
  props: ['vtt', 'src', 'trust', 'kind', 'cues', 'chapters', 'currentTime', 'onSeek'],
  load: () => import('./MediaCaptionsDemo.svelte'),
});
