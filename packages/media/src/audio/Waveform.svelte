<script lang="ts">
import { clampSeekRatio } from './model.ts';
import type { WaveformProps } from './types.ts';
import './audio.css';

/**
 * Keyboard-operable waveform: bars from peak samples, seek by pointer or arrows.
 */
let {
  peaks,
  progress = 0,
  label = 'Waveform',
  disabled = false,
  class: className,
  onSeek,
}: WaveformProps = $props();

const ratio = $derived(clampSeekRatio(progress));
const bars = $derived(peaks.length > 0 ? peaks : [0]);

function seekFromClientX(clientX: number, target: Element): void {
  if (disabled || !onSeek) return;
  const box = target.getBoundingClientRect();
  if (box.width <= 0) return;
  onSeek(clampSeekRatio((clientX - box.left) / box.width));
}

function onpointerdown(event: PointerEvent): void {
  if (disabled || (event.pointerType === 'mouse' && event.button !== 0)) return;
  event.preventDefault();
  const el = event.currentTarget as HTMLElement;
  seekFromClientX(event.clientX, el);
  try {
    el.setPointerCapture(event.pointerId);
  } catch {
    // ignore
  }
}

function onpointermove(event: PointerEvent): void {
  if (disabled || !(event.currentTarget as HTMLElement).hasPointerCapture?.(event.pointerId)) {
    return;
  }
  seekFromClientX(event.clientX, event.currentTarget as Element);
}

function onkeydown(event: KeyboardEvent): void {
  if (disabled || !onSeek) return;
  const step = event.shiftKey ? 0.1 : 0.02;
  if (event.key === 'ArrowRight' || event.key === 'ArrowUp') {
    event.preventDefault();
    onSeek(clampSeekRatio(ratio + step));
  } else if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') {
    event.preventDefault();
    onSeek(clampSeekRatio(ratio - step));
  } else if (event.key === 'Home') {
    event.preventDefault();
    onSeek(0);
  } else if (event.key === 'End') {
    event.preventDefault();
    onSeek(1);
  }
}

const width = 100;
const height = 32;
const gap = 0.35;
</script>

<svg
  class={['tx-audio-waveform', className]}
  viewBox="0 0 {width} {height}"
  role="slider"
  aria-label={label}
  aria-valuemin={0}
  aria-valuemax={100}
  aria-valuenow={Math.round(ratio * 100)}
  aria-valuetext="{Math.round(ratio * 100)} percent"
  aria-disabled={disabled ? 'true' : undefined}
  tabindex={disabled ? -1 : 0}
  data-tx-audio-waveform=""
  {onpointerdown}
  {onpointermove}
  {onkeydown}
>
  {#each bars as peak, i (i)}
    {@const barW = width / bars.length}
    {@const h = Math.max(1, peak * (height - 2))}
    {@const played = i / bars.length <= ratio}
    <rect
      class={played ? 'tx-audio-waveform__bar tx-audio-waveform__bar--played' : 'tx-audio-waveform__bar'}
      x={i * barW + gap / 2}
      y={(height - h) / 2}
      width={Math.max(0.4, barW - gap)}
      height={h}
      rx="0.4"
    />
  {/each}
</svg>
