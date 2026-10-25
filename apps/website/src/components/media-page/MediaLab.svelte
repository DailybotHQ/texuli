<script lang="ts">
/**
 * Media lab island: image, video, audio, composition preview, and browser
 * export (PNG / SVG / WebM). Same-origin assets and synthetic audio only —
 * no foreign network. Fictional Harbor Notes copy.
 */

import { sampleComposition, validateAnimation } from '@texuli/media/animation';
import { AudioPlayer, buildWaveformPeaks, Waveform } from '@texuli/media/audio';
import { CompositionCanvas } from '@texuli/media/composition-canvas';
import { validateComposition } from '@texuli/media/composition-model';
import { CompositionExport } from '@texuli/media/export/ui';
import { Image } from '@texuli/media/image';
import { VideoPlayer } from '@texuli/media/video';
import { onDestroy, onMount } from 'svelte';
import {
  LAB_ANIMATION,
  LAB_CAPTIONS_VTT,
  LAB_CHAPTERS_VTT,
  LAB_COMPOSITION,
  LAB_IMAGE_SRC,
  LAB_IMAGE_TINY,
  LAB_UNSAFE_COMPOSITION,
} from './samples.ts';

const compositionResult = validateComposition(LAB_COMPOSITION);
const composition = compositionResult.ok ? compositionResult.composition : null;
const animationResult =
  composition === null ? null : validateAnimation(LAB_ANIMATION, { composition });
const animation = animationResult?.ok ? animationResult.animation : null;
const middle =
  composition && animation ? sampleComposition(composition, animation, 500) : composition;

const tracks = [
  { id: 'en', label: 'English', kind: 'captions' as const, vtt: LAB_CAPTIONS_VTT, default: true },
  { id: 'chapters', label: 'Chapters', kind: 'chapters' as const, vtt: LAB_CHAPTERS_VTT },
];

function buildTonePeaks(bars = 48): number[] {
  const samples = Float32Array.from({ length: bars * 8 }, (_, i) => {
    const t = i / (bars * 8);
    const envelope = Math.sin(Math.PI * t);
    return envelope * (0.35 + 0.65 * Math.abs(Math.sin(i * 0.37)));
  });
  return buildWaveformPeaks(samples, bars);
}

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

const peaks = buildTonePeaks(48);
let audioUrl = $state('');
let waveProgress = $state(0.4);
let exportLog = $state('');

onMount(() => {
  audioUrl = URL.createObjectURL(makeDemoWav(2));
});

onDestroy(() => {
  if (audioUrl) URL.revokeObjectURL(audioUrl);
});

function onExport(file: { format: string; filename: string }) {
  exportLog = `Saved ${file.filename} (${file.format})`;
}
</script>

<div class="lab" data-tx-media-lab>
  <header class="intro">
    <h1 id="media-lab-title">Media lab</h1>
    <p class="lead">
      Image, video, audio and layered compositions — including browser export to PNG and WebM.
      Assets are same-origin or synthetic; nothing is fetched from another origin. Fictional Harbor
      Notes copy only.
    </p>
  </header>

  <nav class="toc" aria-label="Media lab sections">
    <a href="#lab-image">Image</a>
    <a href="#lab-video">Video</a>
    <a href="#lab-audio">Audio</a>
    <a href="#lab-composition">Composition &amp; export</a>
  </nav>

  <section id="lab-image" class="panel" aria-labelledby="lab-image-h">
    <h2 id="lab-image-h">Image</h2>
    <p>
      Responsive <code>Image</code> with a local SVG, blur-up placeholder, and a blocked
      <code>javascript:</code> source (URL policy).
    </p>
    <div class="row">
      <Image
        src={LAB_IMAGE_SRC}
        alt="Fishing boats in a harbor at sunset, fictional illustration"
        width={480}
        height={270}
        loading="eager"
        placeholder={{ kind: 'blur', src: LAB_IMAGE_TINY }}
        class="hero"
      />
      <Image
        src="javascript:alert(1)"
        alt="Blocked: a javascript URL cannot load"
        width={240}
        height={135}
      />
    </div>
  </section>

  <section id="lab-video" class="panel" aria-labelledby="lab-video-h">
    <h2 id="lab-video-h">Video</h2>
    <p>
      Player chrome with inline WebVTT captions and chapters. The demo source is refused by the
      media URL policy so no remote media is requested; the poster is the local harbor SVG.
    </p>
    <VideoPlayer
      src="javascript:alert(1)"
      poster={LAB_IMAGE_SRC}
      {tracks}
      showTranscript
      title="Harbor ferry tour (blocked remote source)"
      playsInline
    />
    <VideoPlayer src="javascript:alert(1)" poster="javascript:alert(1)" title="Fully blocked video" />
  </section>

  <section id="lab-audio" class="panel" aria-labelledby="lab-audio-h">
    <h2 id="lab-audio-h">Audio</h2>
    <p>Synthetic waveform peaks and a short blob WAV generated in the page (no network).</p>
    {#if audioUrl}
      <AudioPlayer src={audioUrl} label="Harbor tone (synthetic)" peaks={peaks} />
    {/if}
    <Waveform
      {peaks}
      progress={waveProgress}
      label="Standalone waveform"
      onSeek={(p) => (waveProgress = p)}
    />
    <AudioPlayer src="javascript:alert(1)" label="Blocked audio" />
  </section>

  <section id="lab-composition" class="panel" aria-labelledby="lab-composition-h">
    <h2 id="lab-composition-h">Composition and export</h2>
    <p>
      A validated composition (shapes and text only) previews on canvas. Export PNG, SVG, or WebM
      entirely in the browser — nothing is uploaded. WebM records the 2&nbsp;s OKLCH color animation
      of the orb.
    </p>
    <h3>Middle frame preview</h3>
    {#if middle}
      <div class="canvas-wrap" data-composition-preview>
        <CompositionCanvas composition={middle} label="Harbor poster, frame at 0.5 seconds" />
      </div>
    {/if}
    {#if composition}
      <CompositionExport
        {composition}
        animation={animation ?? undefined}
        filename="harbor-media-lab"
        title="Harbor media lab poster"
        background="#0f172a"
        fps={24}
        onexport={onExport}
        labels={{ group: 'Export the harbor poster' }}
      />
    {/if}
    {#if exportLog}
      <p class="export-log" role="status" data-export-log>{exportLog}</p>
    {/if}

    <h3>Unsafe image layer</h3>
    <p>An image with a <code>javascript:</code> source is refused; exports explain why.</p>
    <CompositionExport
      composition={LAB_UNSAFE_COMPOSITION}
      filename="unsafe-lab"
      labels={{ group: 'Export the unsafe composition' }}
    />
  </section>
</div>

<style>
  .lab {
    display: grid;
    gap: 1.75rem;
  }
  .intro h1 {
    margin: 0 0 0.35rem;
    font-size: clamp(1.75rem, 5vw, 2.75rem);
    line-height: 1.15;
    color: var(--tx-foreground);
  }
  .lead {
    margin: 0;
    max-inline-size: 44rem;
    color: var(--tx-foreground);
    font-size: 1.05rem;
  }
  .toc {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem 1rem;
  }
  .toc a {
    color: var(--tx-link, var(--tx-foreground));
    min-block-size: 2.5rem;
    display: inline-flex;
    align-items: center;
  }
  .panel {
    display: grid;
    gap: 0.75rem;
    padding: 1.25rem;
    border: 1px solid var(--tx-border);
    border-radius: var(--tx-radius, 0.5rem);
    background: var(--tx-surface, var(--tx-background));
    color: var(--tx-foreground);
  }
  .panel h2,
  .panel h3,
  .panel p {
    margin: 0;
  }
  .panel h2 {
    font-size: 1.35rem;
  }
  .panel h3 {
    font-size: 1.05rem;
  }
  .row {
    display: flex;
    flex-wrap: wrap;
    gap: 1rem;
    align-items: start;
  }
  .canvas-wrap {
    max-inline-size: 30rem;
    border: 1px solid var(--tx-border);
    border-radius: var(--tx-radius, 0.375rem);
    overflow: hidden;
  }
  .export-log {
    font-size: 0.9rem;
    font-weight: 600;
  }
  :global(.lab .hero) {
    max-inline-size: 30rem;
  }
</style>
