<script lang="ts">
import { onDestroy } from 'svelte';
import { Button } from 'texuli/button';
import { type ClassValue, cx } from 'texuli/cx';
import type { VideoTrimRange } from '../video/edit.ts';
import { type CompositionExportLabels, resolveCompositionExportLabels } from './labels.ts';
import './export.css';

/**
 * Export buttons for a composition (PNG, SVG) and its animation (WebM). The
 * exporters load on first use; each export validates the data (untrusted by
 * default), keeps images to the media URL policy and saves the file through a
 * temporary download link. Nothing is sent over the network.
 */
type Props = {
  /** Untrusted composition data. */
  composition: unknown;
  /** Untrusted animation data; adds the WebM button. */
  animation?: unknown;
  /** Download name without extension (sanitized). */
  filename?: string;
  /** URL policy tier. Default `untrusted`. */
  trust?: 'developer' | 'untrusted';
  /** Pixel ratio of the PNG and the video. Default 2 for PNG, 1 for WebM. */
  pixelRatio?: number;
  /** Painted under every layer of PNG and WebM exports (SVG stays transparent). */
  background?: string;
  /** SVG `<title>`. */
  title?: string;
  /** Frames per second of the WebM recording. Default 30. */
  fps?: number;
  /** Optional source interval for the WebM export. */
  trim?: VideoTrimRange;
  labels?: Partial<CompositionExportLabels>;
  class?: ClassValue;
  /** Called with each saved file (also in tests, where downloads are not real). */
  onexport?: (file: { format: 'png' | 'svg' | 'webm'; blob: Blob; filename: string }) => void;
};

let {
  composition,
  animation,
  filename,
  trust = 'untrusted',
  pixelRatio,
  background,
  title,
  fps,
  trim,
  labels,
  class: className,
  onexport,
}: Props = $props();

const text = $derived(resolveCompositionExportLabels(labels));
const uid = $props.id();

let status = $state('');
let tone = $state<'idle' | 'done' | 'error'>('idle');
let progress = $state<number | null>(null);
let busy = $state<'png' | 'svg' | 'webm' | null>(null);
let webmSupported = $state<boolean | null>(null);
let controller: AbortController | null = null;

$effect(() => {
  if (animation === undefined) return;
  let current = true;
  void import('./webm-support.ts').then(({ canExportWebm }) => {
    if (current) webmSupported = canExportWebm();
  });
  return () => {
    current = false;
  };
});

onDestroy(() => controller?.abort());

type Failure = { ok: false; reason: string };
type Success = {
  ok: true;
  blob: Blob;
  filename: string;
  refusedSources?: string[];
  failedSources?: string[];
};

function report(format: 'png' | 'svg' | 'webm', result: Success | Failure): void {
  if (!result.ok) {
    const reason = result.reason;
    tone = reason === 'aborted' ? 'idle' : 'error';
    status =
      reason === 'invalid'
        ? text.invalid
        : reason === 'tainted'
          ? text.tainted
          : reason === 'unsupported'
            ? text.unsupported
            : reason === 'aborted'
              ? text.aborted
              : text.failed;
    return;
  }
  void import('./download.ts').then(({ downloadBlob }) =>
    downloadBlob(result.blob, result.filename)
  );
  onexport?.({ format, blob: result.blob, filename: result.filename });
  const skipped = (result.refusedSources?.length ?? 0) + (result.failedSources?.length ?? 0);
  tone = 'done';
  status =
    skipped > 0
      ? `${text.done(result.filename)} ${text.skippedImages(skipped)}`
      : text.done(result.filename);
}

async function run(format: 'png' | 'svg' | 'webm'): Promise<void> {
  if (busy) return;
  busy = format;
  tone = 'idle';
  status = text.working(format.toUpperCase());
  try {
    if (format === 'svg') {
      const { exportSvg } = await import('./svg.ts');
      report(
        'svg',
        exportSvg(composition, {
          trust,
          ...(title ? { title } : {}),
          ...(filename ? { filename } : {}),
        })
      );
    } else if (format === 'png') {
      const { exportPng } = await import('./png.ts');
      report(
        'png',
        await exportPng(composition, {
          trust,
          pixelRatio: pixelRatio ?? 2,
          ...(background ? { background } : {}),
          ...(filename ? { filename } : {}),
        })
      );
    } else {
      const { exportWebm } = await import('./webm.ts');
      controller = new AbortController();
      progress = 0;
      report(
        'webm',
        await exportWebm(composition, animation, {
          trust,
          signal: controller.signal,
          onProgress: (done) => {
            progress = Math.round(done * 100);
          },
          ...(pixelRatio ? { pixelRatio } : {}),
          ...(fps ? { fps } : {}),
          ...(trim ? { trim } : {}),
          ...(background ? { background } : {}),
          ...(filename ? { filename } : {}),
        })
      );
    }
  } catch {
    tone = 'error';
    status = text.failed;
  } finally {
    busy = null;
    progress = null;
    controller = null;
  }
}
</script>

<div class={cx('tx-export', className)} data-tx-composition-export>
  <div class="tx-export__buttons" role="group" aria-label={text.group}>
    <Button variant="outline" size="sm" disabled={busy !== null && busy !== 'png'} onclick={() => run('png')}>
      {text.png}
    </Button>
    <Button variant="outline" size="sm" disabled={busy !== null && busy !== 'svg'} onclick={() => run('svg')}>
      {text.svg}
    </Button>
    {#if animation !== undefined}
      <Button
        variant="outline"
        size="sm"
        disabled={webmSupported === false || (busy !== null && busy !== 'webm')}
        aria-describedby={webmSupported === false ? `tx-export-webm-${uid}` : undefined}
        onclick={() => run('webm')}
      >
        {text.webm}
      </Button>
      {#if busy === 'webm'}
        <Button variant="ghost" size="sm" onclick={() => controller?.abort()}>{text.cancel}</Button>
      {/if}
    {/if}
  </div>
  {#if animation !== undefined && webmSupported === false}
    <p class="tx-export__note" id={`tx-export-webm-${uid}`}>{text.webmUnsupported}</p>
  {/if}
  {#if progress !== null}
    <progress class="tx-export__progress" max="100" value={progress} aria-label={text.recording(progress)}></progress>
  {/if}
  <p class="tx-export__status" role="status" aria-live="polite" data-tone={tone}>{status}</p>
</div>
