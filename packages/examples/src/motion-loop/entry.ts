import { defineExample } from '../registry.ts';

export const texuliMotionLoopExample = defineExample({
  id: 'texuli-motion-loop',
  title: 'Looping motion: a voice waveform',
  description:
    'MotionLoop from texuli/motion/loop: five waveform bars that wave while a fictional voice note plays and a live dot that pulses, on the motion tokens. Static at rest under reduced motion or level none.',
  tags: ['texuli', 'motion', 'loop', 'a11y'],
  component: 'texuli/MotionLoop',
  props: ['preset', 'playing', 'duration', 'stagger'],
  load: () => import('./MotionLoopDemo.svelte'),
});
