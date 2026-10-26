import { defineExample } from '../registry.ts';

export const mediaAnimationTimelineExample = defineExample({
  id: 'media-animation-timeline',
  title: 'Animation timeline editor',
  description:
    'Edits a fictional lower-third composition with a selected keyframe, live preview, and an RTL timeline view.',
  tags: ['media', 'animation', 'timeline', 'editing', 'rtl'],
  component: 'media/AnimationTimeline',
  props: ['composition', 'animation', 'value', 'timeMs', 'preview', 'trust'],
  load: () => import('./MediaAnimationTimelineDemo.svelte'),
});
