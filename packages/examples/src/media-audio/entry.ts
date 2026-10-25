import { defineExample } from '../registry.ts';

/** Audio player and waveform example (T-media-audio). */
export const mediaAudioExample = defineExample({
  id: 'media-audio',
  title: 'Audio player and waveform',
  description:
    'Play/pause and keyboard seek on a waveform built from peak samples. Untrusted sources go through the media URL policy; unsafe URLs are refused.',
  tags: ['media', 'audio', 'waveform', 'security', 'a11y', 'keyboard', 'dark'],
  component: 'media/AudioPlayer',
  props: ['src', 'trust', 'allowedOrigins', 'peaks', 'label', 'barCount'],
  load: () => import('./MediaAudioDemo.svelte'),
});
