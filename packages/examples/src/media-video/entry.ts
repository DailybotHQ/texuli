import { defineExample } from '../registry.ts';

export const mediaVideoExample = defineExample({
  id: 'media-video',
  title: 'Video player',
  description:
    'Accessible custom playback controls with captions toggle (C), track picker, on-video cue text, chapter menu, optional transcript, picture-in-picture, and blocked-source state.',
  tags: ['media', 'video', 'captions', 'chapters', 'accessibility', 'security', 'keyboard', 'dark'],
  component: 'media/VideoPlayer',
  props: [
    'src',
    'poster',
    'title',
    'trust',
    'allowedOrigins',
    'tracks',
    'captionsDefault',
    'showTranscript',
    'loop',
    'muted',
    'playsInline',
  ],
  load: () => import('./MediaVideoDemo.svelte'),
});
