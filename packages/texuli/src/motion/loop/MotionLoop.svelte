<script lang="ts">
/**
 * A looping motion over its children (D-G-046): each direct child plays the
 * preset forever, offset by the stagger, while `playing` is true. At rest
 * (not playing, level `none`, reduced motion) the children are static in
 * their own style. The keyframes are Texuli's (`loop.css`); the period,
 * delay and curve are theme tokens.
 */
import type { Snippet } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';
import { type ClassValue, cx } from '../../internal/cx.ts';
import { getMotionSettings } from '../context.ts';
import type { MotionDurationName } from '../contract.ts';
import {
  loopDuration,
  loopStagger,
  type MotionLoopPreset,
  type MotionLoopStagger,
  resolveMotionLoop,
} from './loop.ts';
import './loop.css';

type Props = HTMLAttributes<HTMLElement> & {
  /** `pulse` (default: dims and shrinks a little) or `wave` (scales along the block axis). */
  preset?: MotionLoopPreset;
  /** `false` keeps the children at rest (bars stop when the audio stops). Default `true`. */
  playing?: boolean;
  /** The period: 4 × `--tx-motion-<step>`. Default `slow` (1.2 s with the default theme). */
  duration?: MotionDurationName;
  /** The offset between neighboring children: `none`, `fast` (default) or `base`. */
  stagger?: MotionLoopStagger;
  /** The root element. Default `span`. */
  as?: 'span' | 'div';
  class?: ClassValue;
  children?: Snippet;
  /** The rendered root element (bindable). */
  ref?: HTMLElement | null;
};

let {
  ref = $bindable(null),
  preset = 'pulse',
  playing = true,
  duration = 'slow',
  stagger = 'fast',
  as = 'span',
  class: className,
  children,
  ...rest
}: Props = $props();

const settings = getMotionSettings();
const loop = $derived(
  resolveMotionLoop({
    preset,
    playing: playing !== false,
    level: settings.level,
    reducedMotion: settings.reducedMotion,
  })
);
</script>

<svelte:element
  this={as === 'div' ? 'div' : 'span'}
  bind:this={ref}
  class={cx('tx-loop', className)}
  data-tx-loop={loop?.preset}
  data-tx-loop-level={loop?.level === 'subtle' ? 'subtle' : undefined}
  data-tx-loop-duration={loopDuration(duration)}
  data-tx-loop-stagger={loopStagger(stagger)}
  {...rest}>{@render children?.()}</svelte:element
>
