# @texuli/canvas

An infinite canvas for [Texuli](https://texuli.com?utm_source=dailybotopensource),
an MIT-licensed Svelte 5 component library by Dailybot, Inc. (*Small
pieces. Infinite possibilities.*). Shapes, text, sticky notes, images,
frames and groups, connectors that route straight, elbow or curved,
selection, transforms with snapping and guides, alignment, z-order, a JSON
clipboard and undo through an op log, all in a framework-free model; CRDT
collaboration on `@texuli/document/sync`; an accessible Svelte 5 editor and
viewer; and SVG and PNG export with no HTML sinks.

> **Status: in development (pre-1.0).** `@texuli/canvas` is published on
> npm as `0.11.2`, with provenance (first published as `0.8.0`; built in PLAN_010).
> Under 0.x a new minor (`0.12.0`) may contain breaking changes, so pin the
> exact version or use `^0.11.0`, which accepts only 0.11.x
> (see [RELEASE](https://github.com/DailybotHQ/texuli/blob/main/docs/RELEASE.md)).
> Agents emit canvases as data through the `canvas` catalog id of blueprint
> spec `0.8.0`; the Kotlin twin validates them and does not paint them yet.

It sits on layer L4. It depends on `@texuli/core` (URL policy, markup
builders, motion, announcer), `@texuli/deck` (the schema kit),
`@texuli/document` (only the `sync` subpath, the CRDT core of ADR-010),
`@texuli/drag` (pan, zoom, snapping, resize and the edge curve shared with
`@texuli/workflows`) and `texuli` (the motion settings); `svelte`
(^5.57.2) is a peer dependency.

## Install

```bash
npm install @texuli/canvas
```

In the Texuli workspace, depend on it as `"@texuli/canvas": "workspace:*"`.
It has no third-party runtime dependencies; its `@texuli/*` and `texuli`
dependencies come with it. Import the token stylesheet once
(`@texuli/tokens/base.css`).

## Quick start

```svelte
<script lang="ts">
  import { CanvasEditor } from '@texuli/canvas/editor';
  import { loadUntrustedCanvas } from '@texuli/canvas/model';
  import '@texuli/tokens/base.css';

  let { json }: { json: string } = $props();
  // Canvases from a file, an agent or a share link: validated first.
  const loaded = loadUntrustedCanvas(json);
  let canvas = $state.raw(loaded.ok ? loaded.canvas : null);
</script>

{#if canvas}
  <CanvasEditor bind:canvas resolveImage={(ref) => `https://cdn.example.com/${ref}.png`} />
{/if}
```

## Subpaths

| Subpath | What it holds | Docs |
| --- | --- | --- |
| `.` | The model, the editor and the viewer, re-exported, and `CANVAS_PACKAGE_VERSION` | this page |
| `./model` | Framework-free and DOM-free: the format, `validateCanvas` and `loadUntrustedCanvas` (untrusted by default), the JSON Schema spec 0.8.0 pins, bounds, hit testing and reading order, connector routing, freehand simplification, typed operations with inverses, the op-log history, and editing helpers that return operations | [model](https://github.com/DailybotHQ/texuli/blob/main/packages/canvas/docs/model.md) |
| `./sync` | Collaboration on `@texuli/document/sync`: the tree, register and sequence binding, a projection that is always valid, seed operations, sessions and presence (pointers and selections) | [sync](https://github.com/DailybotHQ/texuli/blob/main/packages/canvas/docs/sync.md) |
| `./export` | `canvasToSvg` (escaped markup through `@texuli/core/markup`) and `canvasToPng` (browser) | [export](https://github.com/DailybotHQ/texuli/blob/main/packages/canvas/docs/export.md) |
| `./editor` | `CanvasEditor` and its parts: the toolbar, the `role="application"` surface, the minimap and the shape tree, over `CanvasController`; the keyboard model | [editor](https://github.com/DailybotHQ/texuli/blob/main/packages/canvas/docs/editor.md) |
| `./viewer` | `CanvasViewer`: a read-only canvas with its structure as text | [viewer](https://github.com/DailybotHQ/texuli/blob/main/packages/canvas/docs/viewer.md) |
| `./host` | `createCanvasPlayerHost`: the `canvasHost` of `@texuli/player` for agent canvases | [host](https://github.com/DailybotHQ/texuli/blob/main/packages/canvas/docs/host.md) |

`CANVAS_PACKAGE_VERSION` equals the package version (`0.9.0`).

## Security

- Canvases are data. `validateCanvas` refuses unknown shapes and keys,
  raw CSS colors (styles are a closed token palette), control and bidi
  characters in text, image refs with a scheme that the URL policy refuses at
  the tier, unknown connector ends, and anything past `CANVAS_LIMITS`, in
  time linear in the input.
- Text paints as SVG text nodes; nothing is parsed as markup (`{@html}`,
  `innerHTML`, `eval` and `new Function` are absent). Image refs are
  resolved by the host and every URL passes `safeImageSrc` at the tier
  (`untrusted` by default).
- The clipboard is untrusted JSON: size-checked, then validated.
- Remote sync batches are validated by the sync core, and the projection
  drops what fails the canvas schema, the same way on every replica.

## Accessibility

The surface is the only `role="application"` region, named by the canvas
title and described by its keyboard instructions. Shapes take a roving tab
stop in reading order; the shape tree beside it (`role="tree"`) lists every
shape and connector for screen readers; changes are announced through the
shared live region. Motion (zoom and fit) plays through `texuli/motion`
and is instant under reduced motion. Forced colors keep outlines, focus and
selection visible. The keyboard model is in
[editor](https://github.com/DailybotHQ/texuli/blob/main/packages/canvas/docs/editor.md).

## License

MIT © Dailybot, Inc. Powered by [Dailybot](https://www.dailybot.com?utm_source=dailybotopensource&utm_medium=texuli-canvas).
