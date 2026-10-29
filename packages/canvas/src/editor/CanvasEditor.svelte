<script lang="ts">
// The complete canvas editor: the tools toolbar, the application surface
// with its minimap, and the shape tree for screen readers, over one
// controller. Each part is exported on its own for custom layouts.
import type { HrefTrust } from '@texuli/core/url-policy';
import { untrack } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';
import { createCanvas } from '../model/document.ts';
import type { CanvasDocument } from '../model/types.ts';
import type { CanvasSync } from '../sync/session.ts';
import CanvasMinimap from './CanvasMinimap.svelte';
import CanvasShapeList from './CanvasShapeList.svelte';
import CanvasSurface from './CanvasSurface.svelte';
import CanvasToolbar from './CanvasToolbar.svelte';
import { CanvasController, historyBackend, syncBackend } from './controller.svelte.ts';
import type { CanvasTool } from './keyboard.ts';
import { type CanvasLabelOverrides, resolveCanvasLabels } from './labels.ts';

interface Props extends Omit<HTMLAttributes<HTMLDivElement>, 'children' | 'onchange'> {
  /**
   * The canvas (validated by the caller: `validateCanvas` or
   * `loadUntrustedCanvas`). Bindable: edits write the new canvas back. A
   * different canvas from outside replaces the document and its history.
   */
  canvas?: CanvasDocument;
  /** Edit a collaborative session instead (`createCanvasSync`); `canvas` is then ignored. */
  sync?: CanvasSync | null;
  readonly?: boolean;
  /** URL tier for image URLs and validation (default `untrusted`). */
  trust?: HrefTrust;
  /** Turn an image `ref` into a URL (checked by `safeImageSrc` at `trust`). */
  resolveImage?: (ref: string) => string | null | undefined;
  dir?: 'ltr' | 'rtl';
  /** Snap to the grid and other shapes (default true). */
  snap?: boolean;
  labels?: CanvasLabelOverrides;
  /** Tools offered in the toolbar (default all). */
  tools?: readonly CanvasTool[];
  toolbar?: boolean;
  minimap?: boolean;
  /** Show the shape tree beside the surface (default true; keep it for screen readers). */
  shapeList?: boolean;
  /** Called with each new canvas. */
  onchange?: (canvas: CanvasDocument) => void;
  /** Announce through this instead of the shared live region. */
  announce?: (message: string) => void;
  /** The shared controller (`bind:controller`). */
  controller?: CanvasController;
  /** The root element (`bind:ref`). */
  ref?: HTMLDivElement | null;
  class?: string;
}

let {
  canvas = $bindable(),
  sync = null,
  readonly = false,
  trust = 'untrusted',
  resolveImage,
  dir = 'ltr',
  snap = true,
  labels,
  tools,
  toolbar = true,
  minimap = true,
  shapeList = true,
  onchange,
  announce,
  controller = $bindable(),
  ref = $bindable(null),
  class: className = '',
  ...rest
}: Props = $props();

const editor = untrack(
  () =>
    new CanvasController({
      backend: sync ? syncBackend(sync) : historyBackend(canvas ?? createCanvas(), trust),
      labels: resolveCanvasLabels(labels),
      readonly,
      dir,
      snap,
      announce,
      onchange: (doc) => {
        if (!sync) canvas = doc;
        onchange?.(doc);
      },
    })
);
controller = editor;

$effect(() => {
  editor.readonly = readonly;
  editor.dir = dir;
  editor.snap = snap;
  editor.labels = resolveCanvasLabels(labels);
});

// A canvas replaced from outside (not one this editor wrote back) starts over.
$effect(() => {
  const next = canvas;
  if (sync || !next) return;
  untrack(() => {
    // A deep `$state` parent hands back a proxy of what the editor wrote: compare content then.
    if (next !== editor.doc && JSON.stringify(next) !== JSON.stringify(editor.doc))
      editor.replace(next);
  });
});

$effect(() => () => editor.destroy());
</script>

<div bind:this={ref} {...rest} class={['tx-canvas-editor', className]} dir={dir} data-shape-list={shapeList || undefined}>
  {#if toolbar}
    <CanvasToolbar controller={editor} {tools} />
  {/if}
  <CanvasSurface controller={editor} {trust} {resolveImage}>
    {#if minimap}<CanvasMinimap controller={editor} />{/if}
  </CanvasSurface>
  {#if shapeList}
    <CanvasShapeList controller={editor} />
  {/if}
</div>

<style>
  @layer tx.components {
    .tx-canvas-editor {
      display: grid;
      grid-template-columns: minmax(0, 1fr);
      grid-template-rows: auto minmax(20rem, 1fr) auto;
      min-block-size: 28rem;
      border: 1px solid var(--tx-border, CanvasText);
      border-radius: var(--tx-radius-lg, 0.75rem);
      overflow: hidden;
      background: var(--tx-surface, Canvas);
      container-type: inline-size;
    }

    /* On narrow editors the overview would cover the canvas: pinch and fit instead. */
    @container (max-width: 36rem) {
      .tx-canvas-editor :global(.tx-canvas-minimap) {
        display: none;
      }
    }

    .tx-canvas-editor > :global(.tx-canvas-toolbar) {
      grid-column: 1 / -1;
    }

    .tx-canvas-editor > :global(.tx-canvas-shape-list) {
      max-block-size: 12rem;
      border-block-start: 1px solid var(--tx-border, CanvasText);
    }

    @media (min-width: 48rem) {
      .tx-canvas-editor[data-shape-list] {
        grid-template-columns: minmax(0, 1fr) 15rem;
        grid-template-rows: auto minmax(24rem, 1fr);
      }

      .tx-canvas-editor > :global(.tx-canvas-shape-list) {
        max-block-size: none;
        border-block-start: 0;
        border-inline-start: 1px solid var(--tx-border, CanvasText);
      }
    }
  }
</style>
