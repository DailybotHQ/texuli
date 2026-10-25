import { defineExample } from '../registry.ts';

export const mediaAnimationExample = defineExample({
  id: 'media-animation',
  title: 'Composition keyframe animation',
  description:
    'Keyframes and easing on composition layers with a timeline scrubber and reduced-motion stills. Fictional example data only.',
  tags: ['media', 'animation', 'composition', 'a11y', 'rtl', 'dark'],
  component: 'media/animation',
  props: ['composition', 'animation', 'reducedMotion', 'initialTimeMs'],
  load: () => import('./MediaAnimationDemo.svelte'),
});
