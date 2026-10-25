<script lang="ts">
import { AudioPlayer, buildWaveformPeaks, Waveform } from '@texuli/media/audio';
import { onDestroy, onMount } from 'svelte';

/**
 * Audio example: synthetic peaks, a blob WAV (untrusted-safe), a standalone
 * waveform for keyboard seek, and a blocked javascript: source. Fictional data.
 */

function buildTonePeaks(bars = 64): number[] {
  const samples = Float32Array.from({ length: bars * 8 }, (_, i) => {
    const t = i / (bars * 8);
    const envelope = Math.sin(Math.PI * t);
    return envelope * (0.35 + 0.65 * Math.abs(Math.sin(i * 0.37)));
  });
  return buildWaveformPeaks(samples, bars);
}

/** Minimal mono 16-bit PCM WAV (silence + soft click envelope) for blob playback. */
function makeDemoWav(seconds = 2, sampleRate = 8_000): Blob {
  const numSamples = sampleRate * seconds;
  const dataSize = numSamples * 2;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);
  const writeStr = (offset: number, s: string) => {
    for (let i = 0; i < s.length; i += 1) view.setUint8(offset + i, s.charCodeAt(i));
  };
  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeStr(36, 'data');
  view.setUint32(40, dataSize, true);
  for (let i = 0; i < numSamples; i += 1) {
    const t = i / sampleRate;
    const env = Math.sin(Math.PI * (i / numSamples));
    const sample = Math.sin(2 * Math.PI * 220 * t) * env * 0.25;
    const int = Math.max(-1, Math.min(1, sample));
    view.setInt16(44 + i * 2, (int * 0x7fff) | 0, true);
  }
  return new Blob([buffer], { type: 'audio/wav' });
}

const peaks = buildTonePeaks(64);
let blobUrl = $state('');
let waveProgress = $state(0.35);

onMount(() => {
  blobUrl = URL.createObjectURL(makeDemoWav(2));
});

onDestroy(() => {
  if (blobUrl) URL.revokeObjectURL(blobUrl);
});
</script>

<article class="demo" data-example="media-audio" aria-labelledby="media-audio-title">
  <h2 id="media-audio-title">Audio player and waveform</h2>
  <p>
    Peak bars are precomputed from a fictional tone so the demo stays deterministic. The clip is a
    short in-memory WAV served as a <code>blob:</code> URL, which the untrusted media policy
    accepts.
  </p>

  <section aria-labelledby="player-title">
    <h3 id="player-title">Player with waveform</h3>
    {#if blobUrl}
      <AudioPlayer
        src={blobUrl}
        {peaks}
        label="Harbor Notes demo clip"
      />
    {:else}
      <p role="status">Preparing demo clip…</p>
    {/if}
  </section>

  <section aria-labelledby="wave-title">
    <h3 id="wave-title">Standalone waveform (keyboard seek)</h3>
    <p>Arrow keys move ±2% (Shift ±10%). Home and End jump to the ends.</p>
    <Waveform
      {peaks}
      progress={waveProgress}
      label="Standalone waveform"
      onSeek={(ratio) => (waveProgress = ratio)}
    />
    <p role="status">
      Progress: <span data-wave-progress>{Math.round(waveProgress * 100)}</span>%
    </p>
  </section>

  <section aria-labelledby="blocked-title">
    <h3 id="blocked-title">Blocked unsafe source</h3>
    <AudioPlayer src="javascript:alert(1)" label="Blocked clip" />
  </section>
</article>

<style>
  .demo {
    display: grid;
    gap: 1.5rem;
    max-inline-size: 36rem;
    padding: 1.5rem;
  }

  .demo h2,
  .demo h3,
  .demo p {
    margin: 0;
  }

  .demo code {
    font-family: var(--tx-font-mono, ui-monospace, monospace);
    font-size: 0.9em;
  }
</style>
