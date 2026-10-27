<script lang="ts">
import type { HrefTrust } from '@texuli/core/url-policy';
import { untrack } from 'svelte';
import { Button, IconButton } from 'texuli/button';
import { type ClassValue, cx } from 'texuli/cx';
import {
  DEFAULT_IMAGE_EDITOR_LABELS,
  describeEdit,
  fillLabel,
  type ImageEditorLabels,
  resolveImageEditorLabels,
} from './labels.ts';
import {
  ANNOTATION_COLORS,
  clampRect,
  createEditHistory,
  createImageEdit,
  cropToAspectRatio,
  type EditHistory,
  editHistoryReducer,
  FILTER_NAMES,
  FILTER_RANGES,
  orientedSize,
  outputSize,
  validateImageEdit,
} from './model.ts';
import {
  drawImageEdit,
  type EditableImage,
  type EditDrawContext,
  type EditImageLoader,
  EXPORT_TYPES,
  type ExportImageEditOptions,
  type ExportImageEditResult,
  type ExportType,
  exportImageEdit,
  loadEditableImage,
} from './render.ts';
import type {
  Annotation,
  AnnotationType,
  EditAction,
  FilterName,
  ImageEdit,
  ImageEditIssue,
  NormalizedRect,
} from './types.ts';

/** Props of the image editor (also the lazy `ImageEditor` shell's props). */
export interface ImageEditorProps {
  /** The image to edit. Untrusted by default: HTTPS or a relative path. */
  src: string;
  /** Describes the image; the preview's accessible name. */
  alt: string;
  /** `developer` also allows HTTP, blob and bounded data images. */
  trust?: HrefTrust;
  /** The edit (`bind:value`). Data from elsewhere is validated first. */
  value?: ImageEdit | unknown;
  labels?: Parameters<typeof resolveImageEditorLabels>[0];
  /** Export format offered first (default PNG). */
  exportType?: ExportType;
  /** JPEG and WebP quality, 0–1. */
  quality?: number;
  /** Annotation text font family. */
  fontFamily?: string;
  class?: ClassValue;
  /** Fires after every change with the new edit. */
  onchange?: (edit: ImageEdit) => void;
  /** Fires when an incoming `value` is refused (the editor keeps its current edit). */
  oninvalid?: (errors: readonly ImageEditIssue[]) => void;
  /** Fires when loading starts, succeeds, is refused by the URL policy, or fails. */
  onstatus?: (status: 'loading' | 'ready' | 'blocked' | 'error') => void;
  /** Receives the exported image and the edit that produced it. */
  onexport?: (result: ExportImageEditResult) => void;
  /** Image loader; the default loads with no referrer and CORS. */
  loader?: EditImageLoader;
  /** Export plumbing overrides (tests, workers). */
  exportOptions?: Pick<ExportImageEditOptions, 'createCanvas' | 'toBlob' | 'filterMode'>;
}

let {
  src,
  alt,
  trust = 'untrusted',
  value = $bindable(),
  labels,
  exportType = 'image/png',
  quality,
  fontFamily,
  class: className,
  onchange,
  oninvalid,
  onstatus,
  onexport,
  loader,
  exportOptions,
}: ImageEditorProps = $props();

const uid = $props.id();
const l: ImageEditorLabels = $derived(
  labels ? resolveImageEditorLabels(labels) : (DEFAULT_IMAGE_EDITOR_LABELS as ImageEditorLabels)
);

let history: EditHistory = $state(createEditHistory());
const edit = $derived(history.present);

// Accept an incoming value only when it validates; never apply part of one.
// Values are compared by content: Svelte proxies what is written to `value`,
// so identity cannot tell our own write from a new value.
const serialize = (input: unknown): string | null => {
  try {
    return JSON.stringify(input) ?? null;
  } catch {
    return null;
  }
};
let lastKey: string | null = null;
$effect.pre(() => {
  const incoming = value;
  if (incoming === undefined) return;
  const key = serialize(incoming);
  if (key !== null && key === lastKey) return;
  lastKey = key;
  const checked = validateImageEdit(incoming);
  if (checked.ok) {
    history = editHistoryReducer(
      untrack(() => history),
      { type: 'replace', edit: checked.edit }
    );
  } else {
    oninvalid?.(checked.errors);
  }
});

function dispatch(action: EditAction | { type: 'undo' } | { type: 'redo' }): void {
  const next =
    action.type === 'undo' || action.type === 'redo'
      ? editHistoryReducer(history, action)
      : editHistoryReducer(history, { type: 'apply', action });
  if (next === history) return;
  history = next;
  lastKey = serialize(next.present);
  value = next.present;
  onchange?.(next.present);
}

// ── loading ────────────────────────────────────────────────────────────────
type Status = 'loading' | 'ready' | 'blocked' | 'error';
let status: Status = $state('loading');
let image = $state.raw<EditableImage | null>(null);
let root: HTMLElement | undefined = $state();

$effect(() => {
  const source = src;
  const tier = trust;
  const doc = root?.ownerDocument;
  if (!doc && !loader) return;
  const controller = new AbortController();
  status = 'loading';
  image = null;
  void loadEditableImage(source, {
    trust: tier,
    ...(doc ? { document: doc } : {}),
    ...(loader ? { loader } : {}),
    signal: controller.signal,
  }).then((result) => {
    if (controller.signal.aborted) return;
    if (result.ok) {
      image = result.image;
      status = 'ready';
    } else if (result.reason !== 'aborted') {
      status = result.reason === 'blocked' ? 'blocked' : 'error';
    }
  });
  return () => controller.abort();
});

$effect(() => {
  onstatus?.(status);
});

const sourceSize = $derived(image ? { width: image.width, height: image.height } : null);
const output = $derived(sourceSize ? outputSize(edit, sourceSize) : null);
const summary = $derived(output ? describeEdit(edit, output, l) : l.summaryNone);

// ── preview ────────────────────────────────────────────────────────────────
let cropping = $state(false);
let cropAspect = $state('free');
let draftCrop: NormalizedRect | null = $state(null);
const shownCrop = $derived(draftCrop ?? edit.crop ?? { x: 0, y: 0, width: 1, height: 1 });
let canvas: HTMLCanvasElement | undefined = $state();
let stageWidth = $state(640);

const previewSize = $derived.by(() => {
  if (!sourceSize || !output) return null;
  const full = cropping ? orientedSize(sourceSize, edit.rotate) : output;
  const ratio = typeof devicePixelRatio === 'number' ? Math.min(2, devicePixelRatio) : 1;
  const width = Math.max(1, Math.min(1600, Math.round(stageWidth * ratio)));
  return { width, height: Math.max(1, Math.round((width * full.height) / full.width)), full };
});

$effect(() => {
  if (!canvas || !image || !previewSize) return;
  canvas.width = previewSize.width;
  canvas.height = previewSize.height;
  const context = canvas.getContext('2d') as EditDrawContext | null;
  if (!context) return;
  drawImageEdit(context, image, edit, {
    width: previewSize.width,
    height: previewSize.height,
    crop: cropping ? 'ignore' : 'apply',
    annotations: !cropping,
    ...(fontFamily ? { fontFamily } : {}),
  });
});

// Track the stage's width only: its height follows the preview, so watching the
// preview itself would loop. The update waits a frame to stay out of layout.
let stage: HTMLElement | undefined = $state();
$effect(() => {
  const element = stage;
  const view = element?.ownerDocument.defaultView;
  if (!element || !view || typeof view.ResizeObserver === 'undefined') return;
  let frame = 0;
  const observer = new view.ResizeObserver(([entry]) => {
    const width = Math.round(entry?.contentRect.width ?? 0);
    if (width <= 0 || width === stageWidth) return;
    view.cancelAnimationFrame(frame);
    frame = view.requestAnimationFrame(() => {
      stageWidth = width;
    });
  });
  observer.observe(element);
  return () => {
    view.cancelAnimationFrame(frame);
    observer.disconnect();
  };
});

// ── crop interaction ─────────────────────────────────────────────────────
const pct = (n: number) => Math.round(n * 1000) / 10;

function commitCrop(rect: NormalizedRect | null): void {
  dispatch({ type: 'crop', rect });
}

function setCropAspect(value: string): void {
  cropAspect = value;
  const ratios: Record<string, number> = { square: 1, landscape: 16 / 9, portrait: 9 / 16 };
  const ratio = ratios[value];
  if (ratio !== undefined && sourceSize) {
    commitCrop(cropToAspectRatio(shownCrop, orientedSize(sourceSize, edit.rotate), ratio));
  }
}

function onCropKeydown(event: KeyboardEvent): void {
  const step = event.altKey ? 0.001 : 0.01;
  const deltas: Record<string, [number, number]> = {
    ArrowLeft: [-step, 0],
    ArrowRight: [step, 0],
    ArrowUp: [0, -step],
    ArrowDown: [0, step],
  };
  const delta = deltas[event.key];
  if (!delta) return;
  event.preventDefault();
  const rect = shownCrop;
  // Image coordinates are physical: arrows are not mirrored in RTL.
  commitCrop(
    event.shiftKey
      ? { ...rect, width: rect.width + delta[0], height: rect.height + delta[1] }
      : { ...rect, x: rect.x + delta[0], y: rect.y + delta[1] }
  );
}

type Drag =
  | {
      kind: 'crop-move' | 'crop-resize' | 'crop-new';
      start: { x: number; y: number };
      rect: NormalizedRect;
      id: number;
    }
  | {
      kind: 'annotation';
      start: { x: number; y: number };
      last: { x: number; y: number };
      annotationId: string;
      id: number;
    };
let drag: Drag | null = null;

function pointAt(event: PointerEvent, element: HTMLElement): { x: number; y: number } {
  const box = element.getBoundingClientRect();
  const x = box.width > 0 ? (event.clientX - box.left) / box.width : 0;
  const y = box.height > 0 ? (event.clientY - box.top) / box.height : 0;
  return { x: Math.min(1, Math.max(0, x)), y: Math.min(1, Math.max(0, y)) };
}

let overlay: HTMLElement | undefined = $state();

function onOverlayPointerDown(event: PointerEvent): void {
  if (event.button !== 0 || !overlay) return;
  const target = event.target as HTMLElement;
  const start = pointAt(event, overlay);
  if (cropping) {
    const kind = target.closest('[data-crop-handle]')
      ? 'crop-resize'
      : target.closest('[data-crop-box]')
        ? 'crop-move'
        : 'crop-new';
    drag = { kind, start, rect: shownCrop, id: event.pointerId };
  } else {
    const annotationId = target.closest<HTMLElement>('[data-annotation-id]')?.dataset.annotationId;
    if (!annotationId) return;
    selectedId = annotationId;
    drag = { kind: 'annotation', start, last: start, annotationId, id: event.pointerId };
  }
  overlay.setPointerCapture?.(event.pointerId);
  event.preventDefault();
}

function onOverlayPointerMove(event: PointerEvent): void {
  const current = drag;
  if (!current || event.pointerId !== current.id || !overlay) return;
  const at = pointAt(event, overlay);
  if (current.kind === 'annotation') {
    dispatch({
      type: 'move-annotation',
      id: current.annotationId,
      dx: at.x - current.last.x,
      dy: at.y - current.last.y,
    });
    current.last = at;
    return;
  }
  const dx = at.x - current.start.x;
  const dy = at.y - current.start.y;
  const { rect, start } = current;
  if (current.kind === 'crop-move') {
    draftCrop = clampRect({ ...rect, x: rect.x + dx, y: rect.y + dy });
  } else if (current.kind === 'crop-resize') {
    draftCrop = sizedRect({ ...rect, width: rect.width + dx, height: rect.height + dy });
  } else {
    draftCrop = sizedRect({
      x: Math.min(start.x, at.x),
      y: Math.min(start.y, at.y),
      width: Math.abs(dx),
      height: Math.abs(dy),
    });
  }
}

/** Keeps the top-start corner and limits the size to what fits (a resize never moves the box). */
function sizedRect(rect: NormalizedRect): NormalizedRect {
  const x = Math.min(0.99, Math.max(0, rect.x));
  const y = Math.min(0.99, Math.max(0, rect.y));
  return clampRect({
    x,
    y,
    width: Math.min(rect.width, 1 - x),
    height: Math.min(rect.height, 1 - y),
  });
}

function onOverlayPointerUp(event: PointerEvent): void {
  if (!drag || event.pointerId !== drag.id) return;
  if (drag.kind !== 'annotation' && draftCrop) commitCrop(draftCrop);
  draftCrop = null;
  drag = null;
}

// ── annotations ──────────────────────────────────────────────────────────
let selectedId: string | null = $state(null);
let counter = 0;
const selected = $derived(edit.annotations.find((a) => a.id === selectedId) ?? null);
const nameOf = (annotation: Annotation, index: number) =>
  fillLabel(l.annotationName, { type: l.types[annotation.type], index: index + 1 });

function nextId(): string {
  let id: string;
  do {
    counter += 1;
    id = `${uid}-a${counter}`;
  } while (edit.annotations.some((a) => a.id === id));
  return id.replace(/[^A-Za-z0-9_-]/g, '-').slice(0, 64);
}

function addAnnotation(type: AnnotationType): void {
  const id = nextId();
  const base = { id, color: ANNOTATION_COLORS[0] as string, strokeWidth: 0.006 };
  const annotation: Annotation =
    type === 'arrow'
      ? { ...base, type, from: { x: 0.3, y: 0.7 }, to: { x: 0.6, y: 0.4 } }
      : type === 'text'
        ? { ...base, type, at: { x: 0.1, y: 0.1 }, text: l.defaultText, fontSize: 0.08 }
        : { ...base, type, frame: { x: 0.3, y: 0.3, width: 0.4, height: 0.3 } };
  dispatch({ type: 'add-annotation', annotation });
  selectedId = id;
}

function onAnnotationKeydown(event: KeyboardEvent, annotation: Annotation): void {
  if (event.key === 'Delete' || event.key === 'Backspace') {
    event.preventDefault();
    removeAnnotation(annotation.id);
    return;
  }
  const step = event.shiftKey ? 0.05 : 0.01;
  const deltas: Record<string, [number, number]> = {
    ArrowLeft: [-step, 0],
    ArrowRight: [step, 0],
    ArrowUp: [0, -step],
    ArrowDown: [0, step],
  };
  const delta = deltas[event.key];
  if (!delta) return;
  event.preventDefault();
  selectedId = annotation.id;
  dispatch({ type: 'move-annotation', id: annotation.id, dx: delta[0], dy: delta[1] });
}

function removeAnnotation(id: string): void {
  const index = edit.annotations.findIndex((a) => a.id === id);
  dispatch({ type: 'remove-annotation', id });
  const rest = edit.annotations;
  selectedId = rest[Math.min(index, rest.length - 1)]?.id ?? null;
}

/** Where an annotation's selection box sits, in normalized image coordinates. */
function boxOf(annotation: Annotation): NormalizedRect {
  if (annotation.type === 'arrow') {
    const x = Math.min(annotation.from.x, annotation.to.x);
    const y = Math.min(annotation.from.y, annotation.to.y);
    return {
      x,
      y,
      width: Math.max(0.02, Math.abs(annotation.to.x - annotation.from.x)),
      height: Math.max(0.02, Math.abs(annotation.to.y - annotation.from.y)),
    };
  }
  if (annotation.type === 'text') {
    const width = Math.min(
      1 - annotation.at.x,
      annotation.text.length * annotation.fontSize * 0.55
    );
    return { x: annotation.at.x, y: annotation.at.y, width, height: annotation.fontSize * 1.2 };
  }
  return annotation.frame;
}

// ── resize ───────────────────────────────────────────────────────────────
let keepAspect = $state(true);

function onResize(axis: 'width' | 'height', raw: string): void {
  if (!output) return;
  const n = Math.round(Number(raw));
  if (!Number.isFinite(n) || n < 1) return;
  const ratio = output.width / output.height;
  const size =
    axis === 'width'
      ? { width: n, height: keepAspect ? Math.max(1, Math.round(n / ratio)) : output.height }
      : { width: keepAspect ? Math.max(1, Math.round(n * ratio)) : output.width, height: n };
  dispatch({ type: 'resize', size });
}

// ── export ───────────────────────────────────────────────────────────────
let chosenFormat = $state<ExportType | null>(null);
const format: ExportType = $derived(
  chosenFormat ?? (EXPORT_TYPES.includes(exportType) ? exportType : 'image/png')
);
let exportMessage = $state('');

async function runExport(): Promise<void> {
  if (!image) return;
  const result = await exportImageEdit(image, edit, {
    type: format,
    ...(quality !== undefined ? { quality } : {}),
    ...(fontFamily ? { fontFamily } : {}),
    ...exportOptions,
  });
  exportMessage = result.ok
    ? fillLabel(l.exported, { width: result.width, height: result.height })
    : result.reason === 'tainted'
      ? l.exportTainted
      : l.exportUnsupported;
  onexport?.(result);
}

// ── shortcuts ────────────────────────────────────────────────────────────
function onRootKeydown(event: KeyboardEvent): void {
  if (!(event.ctrlKey || event.metaKey) || event.altKey) return;
  const target = event.target as HTMLElement | null;
  if (target?.closest('input[type="text"], textarea, [contenteditable="true"]')) return;
  const key = event.key.toLowerCase();
  if (key === 'z' && !event.shiftKey) {
    event.preventDefault();
    dispatch({ type: 'undo' });
  } else if ((key === 'z' && event.shiftKey) || key === 'y') {
    event.preventDefault();
    dispatch({ type: 'redo' });
  }
}

const filterValue = (name: FilterName) =>
  name === 'blur'
    ? `${Math.round(edit.filters.blur * 1000) / 10}%`
    : name === 'hueRotate'
      ? `${edit.filters.hueRotate}°`
      : `${edit.filters[name]}%`;
</script>

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<section
  bind:this={root}
  class={cx('tx-image-editor', className)}
  aria-label={l.editor}
  data-status={status}
  onkeydown={onRootKeydown}
>
  <div class="tx-ie-stage" bind:this={stage}>
    {#if status === 'ready' && previewSize}
      <div class="tx-ie-frame" style:aspect-ratio={`${previewSize.width} / ${previewSize.height}`}>
        <!-- The picture is the image; the canvas inside is its pixels. -->
        <div class="tx-ie-picture" role="img" aria-label={alt} aria-describedby={`${uid}-summary`}>
          <canvas bind:this={canvas} class="tx-ie-canvas" aria-hidden="true"></canvas>
        </div>
        <div
          bind:this={overlay}
          class="tx-ie-overlay"
          data-cropping={cropping ? 'true' : undefined}
          aria-hidden={cropping ? undefined : 'true'}
          onpointerdown={onOverlayPointerDown}
          onpointermove={onOverlayPointerMove}
          onpointerup={onOverlayPointerUp}
          onpointercancel={onOverlayPointerUp}
          role="presentation"
        >
          {#if cropping}
            <!-- A focusable crop box: arrows move it, Shift+arrows resize it (no APG role fits better). -->
            <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
            <div
              class="tx-ie-crop"
              data-crop-box
              role="group"
              tabindex="0"
              aria-label={fillLabel(l.cropArea, {
                x: pct(shownCrop.x),
                y: pct(shownCrop.y),
                width: pct(shownCrop.width),
                height: pct(shownCrop.height),
              })}
              aria-describedby={`${uid}-crop-hint`}
              style:inset-inline-start={`${shownCrop.x * 100}%`}
              style:inset-block-start={`${shownCrop.y * 100}%`}
              style:inline-size={`${shownCrop.width * 100}%`}
              style:block-size={`${shownCrop.height * 100}%`}
              onkeydown={onCropKeydown}
            >
              <span class="tx-ie-handle" data-crop-handle aria-hidden="true"></span>
            </div>
          {:else}
            {#each edit.annotations as annotation (annotation.id)}
              {@const box = boxOf(annotation)}
              <div
                class="tx-ie-mark"
                data-annotation-id={annotation.id}
                data-selected={annotation.id === selectedId ? 'true' : undefined}
                style:inset-inline-start={`${box.x * 100}%`}
                style:inset-block-start={`${box.y * 100}%`}
                style:inline-size={`${box.width * 100}%`}
                style:block-size={`${box.height * 100}%`}
              ></div>
            {/each}
          {/if}
        </div>
      </div>
      <p id={`${uid}-summary`} class="tx-ie-sr">{summary}</p>
      {#if cropping}<p id={`${uid}-crop-hint`} class="tx-ie-hint">{l.cropHint}</p>{/if}
    {:else if status === 'loading'}
      <p class="tx-ie-note" role="status">{l.loading}</p>
    {:else}
      <p class="tx-ie-note" role="alert" data-reason={status}>
        {status === 'blocked' ? l.blocked : l.unavailable}
      </p>
    {/if}
  </div>

  {#if status === 'ready' && output}
    <div class="tx-ie-panels">
      <fieldset class="tx-ie-group">
        <legend class="tx-ie-heading">{l.history}</legend>
        <div class="tx-ie-row">
          <Button size="sm" variant="outline" disabled={history.past.length === 0} aria-keyshortcuts="Control+Z Meta+Z" onclick={() => dispatch({ type: 'undo' })}>{l.undo}</Button>
          <Button size="sm" variant="outline" disabled={history.future.length === 0} aria-keyshortcuts="Control+Shift+Z Meta+Shift+Z Control+Y" onclick={() => dispatch({ type: 'redo' })}>{l.redo}</Button>
          <Button size="sm" variant="ghost" onclick={() => dispatch({ type: 'reset' })}>{l.reset}</Button>
        </div>
      </fieldset>

      <fieldset class="tx-ie-group">
        <legend class="tx-ie-heading">{l.transform}</legend>
        <div class="tx-ie-row">
          <IconButton label={l.rotateLeft} variant="outline" onclick={() => dispatch({ type: 'rotate', turns: -1 })}>
            <svg viewBox="0 0 16 16" aria-hidden="true" class="tx-ie-icon"><path d="M3 5h5a5 5 0 1 1-5 5" /><path d="M5.5 2.5 3 5l2.5 2.5" /></svg>
          </IconButton>
          <IconButton label={l.rotateRight} variant="outline" onclick={() => dispatch({ type: 'rotate', turns: 1 })}>
            <svg viewBox="0 0 16 16" aria-hidden="true" class="tx-ie-icon"><path d="M13 5H8a5 5 0 1 0 5 5" /><path d="M10.5 2.5 13 5l-2.5 2.5" /></svg>
          </IconButton>
          <IconButton label={l.flipX} variant="outline" aria-pressed={edit.flipX} onclick={() => dispatch({ type: 'flip', axis: 'x' })}>
            <svg viewBox="0 0 16 16" aria-hidden="true" class="tx-ie-icon"><path d="M8 2v12" /><path d="M6 4 2 12h4z" /><path d="M10 4l4 8h-4z" /></svg>
          </IconButton>
          <IconButton label={l.flipY} variant="outline" aria-pressed={edit.flipY} onclick={() => dispatch({ type: 'flip', axis: 'y' })}>
            <svg viewBox="0 0 16 16" aria-hidden="true" class="tx-ie-icon"><path d="M2 8h12" /><path d="M4 6l8-4v4z" /><path d="M4 10l8 4v-4z" /></svg>
          </IconButton>
        </div>
      </fieldset>

      <fieldset class="tx-ie-group">
        <legend class="tx-ie-heading">{l.crop}</legend>
        <div class="tx-ie-row">
          <Button size="sm" variant={cropping ? 'default' : 'outline'} aria-pressed={cropping} onclick={() => (cropping = !cropping)}>
            {cropping ? l.cropDone : l.cropEdit}
          </Button>
          <Button size="sm" variant="ghost" disabled={!edit.crop} onclick={() => commitCrop(null)}>{l.cropReset}</Button>
        </div>
        <label class="tx-ie-field">
          <span>{l.cropAspect}</span>
          <select value={cropAspect} onchange={(event) => setCropAspect((event.currentTarget as HTMLSelectElement).value)}>
            <option value="free">{l.cropAspectFree}</option>
            <option value="square">{l.cropAspectSquare}</option>
            <option value="landscape">{l.cropAspectLandscape}</option>
            <option value="portrait">{l.cropAspectPortrait}</option>
          </select>
        </label>
        <div class="tx-ie-fields">
          {#each [['x', l.cropX], ['y', l.cropY], ['width', l.cropWidth], ['height', l.cropHeight]] as const as [key, text] (key)}
            <label class="tx-ie-field">
              <span>{text}</span>
              <input
                type="number"
                inputmode="decimal"
                min="0"
                max="100"
                step="0.1"
                value={pct(shownCrop[key])}
                onchange={(event) => {
                  const n = Number((event.currentTarget as HTMLInputElement).value);
                  if (Number.isFinite(n)) commitCrop({ ...shownCrop, [key]: n / 100 });
                }}
              />
            </label>
          {/each}
        </div>
      </fieldset>

      <fieldset class="tx-ie-group">
        <legend class="tx-ie-heading">{l.resize}</legend>
        <div class="tx-ie-fields">
          <label class="tx-ie-field">
            <span>{l.resizeWidth}</span>
            <input type="number" min="1" max="8192" step="1" value={output.width} onchange={(event) => onResize('width', (event.currentTarget as HTMLInputElement).value)} />
          </label>
          <label class="tx-ie-field">
            <span>{l.resizeHeight}</span>
            <input type="number" min="1" max="8192" step="1" value={output.height} onchange={(event) => onResize('height', (event.currentTarget as HTMLInputElement).value)} />
          </label>
        </div>
        <div class="tx-ie-row">
          <label class="tx-ie-check"><input type="checkbox" bind:checked={keepAspect} /> {l.keepAspect}</label>
          <Button size="sm" variant="ghost" disabled={!edit.resize} onclick={() => dispatch({ type: 'resize', size: null })}>{l.resizeReset}</Button>
        </div>
      </fieldset>

      <fieldset class="tx-ie-group">
        <legend class="tx-ie-heading">{l.adjust}</legend>
        {#each FILTER_NAMES as name (name)}
          {@const range = FILTER_RANGES[name]}
          <label class="tx-ie-slider">
            <span class="tx-ie-slider-label">{l.filters[name]}</span>
            <input
              type="range"
              min={range.min}
              max={range.max}
              step={range.step}
              value={edit.filters[name]}
              aria-valuetext={filterValue(name)}
              data-filter={name}
              oninput={(event) => dispatch({ type: 'filter', name, value: Number((event.currentTarget as HTMLInputElement).value) })}
            />
            <output aria-hidden="true">{filterValue(name)}</output>
          </label>
        {/each}
        <div class="tx-ie-row">
          <Button size="sm" variant="ghost" onclick={() => dispatch({ type: 'reset-filters' })}>{l.resetFilters}</Button>
        </div>
      </fieldset>

      <fieldset class="tx-ie-group">
        <legend class="tx-ie-heading">{l.annotate}</legend>
        <div class="tx-ie-row">
          {#each ['rect', 'ellipse', 'arrow', 'text'] as const as type (type)}
            <Button size="sm" variant="outline" onclick={() => addAnnotation(type)}>{l.add[type]}</Button>
          {/each}
        </div>
        {#if edit.annotations.length === 0}
          <p class="tx-ie-hint">{l.noAnnotations}</p>
        {:else}
          <ul class="tx-ie-list" aria-label={l.annotationList} aria-describedby={`${uid}-annotation-hint`}>
            {#each edit.annotations as annotation, index (annotation.id)}
              <li>
                <button
                  type="button"
                  class="tx-ie-item"
                  aria-pressed={annotation.id === selectedId}
                  data-annotation-item={annotation.id}
                  onclick={() => (selectedId = annotation.id)}
                  onkeydown={(event) => onAnnotationKeydown(event, annotation)}
                >
                  <span class="tx-ie-swatch" style:background-color={annotation.color} aria-hidden="true"></span>
                  {nameOf(annotation, index)}
                </button>
              </li>
            {/each}
          </ul>
          <p id={`${uid}-annotation-hint`} class="tx-ie-hint">{l.annotationHint}</p>
          {#if selected}
            <div class="tx-ie-selected">
              <div class="tx-ie-swatches" role="group" aria-label={l.color}>
                {#each ANNOTATION_COLORS as color, i (color)}
                  <button
                    type="button"
                    class="tx-ie-color"
                    style:background-color={color}
                    aria-label={l.colors[i] ?? color}
                    aria-pressed={selected.color === color}
                    onclick={() => dispatch({ type: 'update-annotation', id: selected.id, patch: { color } })}
                  ></button>
                {/each}
              </div>
              {#if selected.type === 'text'}
                <label class="tx-ie-field tx-ie-wide">
                  <span>{l.text}</span>
                  <input
                    type="text"
                    maxlength="280"
                    value={selected.text}
                    oninput={(event) => {
                      const text = (event.currentTarget as HTMLInputElement).value;
                      if (text.trim()) dispatch({ type: 'update-annotation', id: selected.id, patch: { text } });
                    }}
                  />
                </label>
              {/if}
              <Button size="sm" variant="destructive" onclick={() => removeAnnotation(selected.id)}>{l.remove}</Button>
            </div>
          {/if}
        {/if}
      </fieldset>

      <fieldset class="tx-ie-group">
        <legend class="tx-ie-heading">{l.export}</legend>
        <div class="tx-ie-row">
          <label class="tx-ie-field">
            <span>{l.exportFormat}</span>
            <select
              value={format}
              onchange={(event) => (chosenFormat = (event.currentTarget as HTMLSelectElement).value as ExportType)}
            >
              {#each EXPORT_TYPES as type (type)}
                <option value={type}>{type.replace('image/', '').toUpperCase()}</option>
              {/each}
            </select>
          </label>
          <Button size="sm" onclick={() => runExport()}>{l.exportButton}</Button>
        </div>
        <p class="tx-ie-status" role="status">{exportMessage}</p>
      </fieldset>
    </div>
  {/if}
</section>

<style>
  @layer tx.components {
    .tx-image-editor {
      display: grid;
      gap: 1rem;
      /* Preview and controls side by side when there is room, stacked otherwise. */
      grid-template-columns: repeat(auto-fit, minmax(min(100%, 20rem), 1fr));
      align-items: start;
      color: var(--tx-foreground, CanvasText);
    }
    .tx-ie-stage {
      min-inline-size: 0;
    }
    .tx-ie-frame {
      position: relative;
      inline-size: 100%;
      overflow: hidden;
      border: var(--tx-border-width, 1px) solid var(--tx-border, light-dark(#d4d4d8, #3f3f46));
      border-radius: var(--tx-radius, 0.5rem);
      background:
        repeating-conic-gradient(var(--tx-muted, light-dark(#f4f4f5, #27272a)) 0 25%, transparent 0 50%) 0 0 /
        1rem 1rem;
    }
    .tx-ie-picture {
      position: absolute;
      inset: 0;
    }
    .tx-ie-canvas {
      display: block;
      inline-size: 100%;
      block-size: 100%;
    }
    /* Image space is physical: the overlay never mirrors in RTL. */
    .tx-ie-overlay {
      position: absolute;
      inset: 0;
      direction: ltr;
      touch-action: none;
    }
    .tx-ie-overlay[data-cropping='true'] {
      cursor: crosshair;
      background: rgb(0 0 0 / 0.001);
    }
    /* Crop chrome sits on the photo, not on the theme surface: a light edge over the
       theme scrim reads on any image. Hosts can retune the pair with the two properties. */
    .tx-ie-crop {
      position: absolute;
      box-shadow: 0 0 0 100vmax var(--tx-scrim, rgb(0 0 0 / 0.5));
      outline: 2px solid var(--tx-image-editor-edge, #ffffff);
      outline-offset: -1px;
      cursor: move;
    }
    .tx-ie-crop:focus-visible {
      outline: var(--tx-focus-ring-width, 3px) solid var(--tx-ring, Highlight);
    }
    .tx-ie-handle {
      position: absolute;
      inset-inline-end: -0.5rem;
      inset-block-end: -0.5rem;
      inline-size: 1rem;
      block-size: 1rem;
      border: 2px solid var(--tx-image-editor-edge-contrast, #000000);
      border-radius: 999px;
      background: var(--tx-image-editor-edge, #ffffff);
      cursor: nwse-resize;
    }
    .tx-ie-mark {
      position: absolute;
      cursor: grab;
    }
    .tx-ie-mark[data-selected='true'] {
      outline: 2px dashed var(--tx-ring, Highlight);
      outline-offset: 2px;
    }
    .tx-ie-panels {
      display: grid;
      gap: 1rem;
      align-content: start;
    }
    .tx-ie-group {
      display: grid;
      gap: 0.5rem;
      min-inline-size: 0;
      margin: 0;
      padding: 0 0 0.75rem;
      border: 0;
      border-block-end: var(--tx-border-width, 1px) solid var(--tx-border, light-dark(#e4e4e7, #3f3f46));
    }
    .tx-ie-heading {
      margin: 0;
      padding: 0;
      font-size: 0.875rem;
      font-weight: var(--tx-font-weight-heading, 600);
    }
    .tx-ie-row {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0.5rem;
    }
    .tx-ie-fields {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(6.5rem, 1fr));
      gap: 0.5rem;
    }
    .tx-ie-field {
      display: grid;
      gap: 0.25rem;
      font-size: 0.8125rem;
    }
    .tx-ie-wide {
      grid-column: 1 / -1;
    }
    .tx-ie-field input,
    .tx-ie-field select {
      min-block-size: 2.25rem;
      padding-inline: 0.5rem;
      border: var(--tx-border-width, 1px) solid var(--tx-input, light-dark(#71717a, #a1a1aa));
      border-radius: var(--tx-radius, 0.375rem);
      background: var(--tx-background, Field);
      color: var(--tx-foreground, FieldText);
      font: inherit;
    }
    .tx-ie-check {
      display: inline-flex;
      align-items: center;
      gap: 0.375rem;
      font-size: 0.8125rem;
    }
    .tx-ie-slider {
      display: grid;
      grid-template-columns: 6.5rem minmax(0, 1fr) 3.5rem;
      align-items: center;
      gap: 0.5rem;
      font-size: 0.8125rem;
    }
    .tx-ie-slider input {
      inline-size: 100%;
      accent-color: var(--tx-primary, light-dark(#5b21b6, #c4b5fd));
    }
    .tx-ie-slider output {
      text-align: end;
      font-variant-numeric: tabular-nums;
    }
    .tx-ie-field input:focus-visible,
    .tx-ie-field select:focus-visible,
    .tx-ie-slider input:focus-visible,
    .tx-ie-check input:focus-visible,
    .tx-ie-item:focus-visible,
    .tx-ie-color:focus-visible {
      outline: var(--tx-focus-ring-width, 2px) solid var(--tx-ring, Highlight);
      outline-offset: var(--tx-focus-ring-offset, 2px);
    }
    .tx-ie-list {
      display: grid;
      gap: 0.25rem;
      margin: 0;
      padding: 0;
      list-style: none;
    }
    .tx-ie-item {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      inline-size: 100%;
      min-block-size: 2.25rem;
      padding-inline: 0.5rem;
      border: var(--tx-border-width, 1px) solid transparent;
      border-radius: var(--tx-radius, 0.375rem);
      background: transparent;
      color: inherit;
      font: inherit;
      font-size: 0.875rem;
      text-align: start;
      cursor: pointer;
    }
    .tx-ie-item[aria-pressed='true'] {
      border-color: var(--tx-border-strong, light-dark(#52525b, #a1a1aa));
      background: var(--tx-muted, light-dark(#f4f4f5, #27272a));
    }
    .tx-ie-swatch {
      inline-size: 0.875rem;
      block-size: 0.875rem;
      border-radius: 999px;
      border: 1px solid var(--tx-border-strong, light-dark(#52525b, #a1a1aa));
    }
    .tx-ie-selected {
      display: grid;
      gap: 0.5rem;
      justify-items: start;
    }
    .tx-ie-swatches {
      display: flex;
      flex-wrap: wrap;
      gap: 0.375rem;
    }
    .tx-ie-color {
      inline-size: 1.75rem;
      block-size: 1.75rem;
      padding: 0;
      border: 2px solid var(--tx-border-strong, light-dark(#52525b, #a1a1aa));
      border-radius: 999px;
      cursor: pointer;
    }
    .tx-ie-color[aria-pressed='true'] {
      box-shadow:
        0 0 0 2px var(--tx-background, Canvas),
        0 0 0 4px var(--tx-foreground, CanvasText);
    }
    .tx-ie-icon {
      inline-size: 1rem;
      block-size: 1rem;
      fill: none;
      stroke: currentColor;
      stroke-width: 1.5;
      stroke-linecap: round;
      stroke-linejoin: round;
    }
    .tx-ie-hint,
    .tx-ie-note,
    .tx-ie-status {
      margin: 0;
      font-size: 0.8125rem;
      color: var(--tx-muted-foreground, light-dark(#52525b, #a1a1aa));
    }
    .tx-ie-status:empty {
      display: none;
    }
    .tx-ie-note {
      padding: 1rem;
      border: var(--tx-border-width, 1px) dashed var(--tx-border, light-dark(#a1a1aa, #52525b));
      border-radius: var(--tx-radius, 0.5rem);
    }
    .tx-ie-sr {
      position: absolute;
      inline-size: 1px;
      block-size: 1px;
      margin: -1px;
      overflow: hidden;
      clip-path: inset(50%);
      white-space: nowrap;
    }
    @media (forced-colors: active) {
      .tx-ie-crop {
        outline-color: Highlight;
        box-shadow: none;
      }
      .tx-ie-item[aria-pressed='true'],
      .tx-ie-color[aria-pressed='true'] {
        outline: 2px solid Highlight;
      }
      .tx-ie-mark[data-selected='true'] {
        outline-color: Highlight;
      }
      .tx-ie-hint,
      .tx-ie-note,
      .tx-ie-status {
        color: CanvasText;
      }
    }
  }
</style>
