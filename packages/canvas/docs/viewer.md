# `@texuli/canvas/viewer`

`CanvasViewer`: a read-only canvas (Svelte 5), lighter than the editor. The
content is fitted into an SVG image (`role="img"`, named by `label` or the
canvas title), and the same shapes and connectors are listed as visually
hidden text in reading order, so a screen reader gets the structure the
picture shows. The player host (`@texuli/canvas/host`) paints canvases with
it. Canvas embeds in `@texuli/pages` documents are typed references today:
the editor and reader show the reference and pass no `canvasHost` to the
player, so painting a canvas embed with this viewer is planned.

> **Status: in development.** Not on npm yet (`0.0.0` placeholder).

```svelte
<script lang="ts">
  import { loadUntrustedCanvas } from '@texuli/canvas/model';
  import { CanvasViewer } from '@texuli/canvas/viewer';

  let { json }: { json: string } = $props();
  const loaded = loadUntrustedCanvas(json);
</script>

{#if loaded.ok}<CanvasViewer canvas={loaded.canvas} />{/if}
```

## Props

- `canvas`: a validated canvas.
- `label`: the accessible name (default: the canvas title).
- `trust`: the URL tier for images (default `untrusted`).
- `resolveImage(ref)`: turns an image `ref` into a URL; it passes
  `safeImageSrc` at `trust`, and a refused or missing image paints its alt
  text instead.
- `dir`: `ltr` or `rtl`.
- `labels`: string overrides (the same `CanvasLabelOverrides` as the editor).
- `padding`: space around the content in world units (default 24).
- `ref` (bindable root element), `class`, and any other attribute, spread on
  the root `figure`.
