# `@texuli/canvas/editor`

The accessible infinite canvas editor (Svelte 5). `CanvasEditor` composes
the tools toolbar, the application surface with its minimap, and the shape
tree for screen readers over one `CanvasController`.

> **Status: in development.** On npm from `0.8.0`, the package's first
> release (pre-1.0).

```svelte
<script lang="ts">
  import { CanvasEditor } from '@texuli/canvas/editor';
  import { createCanvas } from '@texuli/canvas/model';

  let canvas = $state.raw(createCanvas({ title: 'Retro board' }));
</script>

<CanvasEditor bind:canvas resolveImage={(ref) => `/assets/${ref}.png`} />
```

## `CanvasEditor` props

- `canvas`: the canvas (validated first: `validateCanvas` or
  `loadUntrustedCanvas`). Bindable: edits write the new canvas back; keep
  it in `$state.raw`. A different canvas from outside replaces the document
  and its history.
- `sync`: a `CanvasSync` session to edit instead (collaboration); undo is
  then the CRDT's selective undo.
- `readonly`: select, pan and zoom only.
- `trust`: the URL tier for images and validation (default `untrusted`).
- `resolveImage(ref)`: turns an image `ref` into a URL, which passes
  `safeImageSrc` at `trust`; refused or missing images paint their alt text.
- `dir`: `ltr` or `rtl` (text alignment, the reading order and the layout).
- `snap`: snap to the grid and to other shapes' edges and centers (default
  true; Alt during a drag skips the grid).
- `labels`: overrides for any string (`CanvasLabelOverrides`).
- `tools`: the tools the toolbar offers (default every `CanvasTool`).
- `toolbar`, `minimap`, `shapeList`: show each part (default true; keep the
  shape list for screen readers).
- `onchange(canvas)`, `announce(message)` (instead of the shared live
  region), `controller` (bindable), `ref` (bindable root element), `class`,
  and any other attribute, spread on the root.

## The keyboard model

The surface is the only `role="application"` region. Shapes hold one
roving tab stop (`canvasCommand` maps keys to a `CanvasCommand`):

| Keys | On a shape | On the empty surface |
| --- | --- | --- |
| Tab, Shift+Tab | Next or previous shape in reading order (selects it); past the last, focus leaves the canvas | Enters the first shape |
| Arrow keys | Move the selection one grid step (Alt: one unit) | Pan |
| Shift+arrow keys | Resize: right and down grow, left and up shrink | — |
| `[` and `]` | Rotate 15° (Shift: 1°) | — |
| Enter or F2 | Edit text in place (Escape or Ctrl/Cmd+Enter finishes) | Create a shape of the active tool at the view center |
| Space | Add to or remove from the selection | — |
| Delete, Backspace | Delete the selection | — |
| K | Connect: Tab to the target, Enter connects, Escape cancels | — |
| Ctrl/Cmd+G, Ctrl/Cmd+Shift+G | Group, ungroup | — |
| Ctrl/Cmd+Z, Ctrl/Cmd+Shift+Z or Y | Undo, redo | Undo, redo |
| Ctrl/Cmd+C, X, V, D, A | Copy, cut, paste, duplicate, select all | Paste, select all |
| Ctrl/Cmd+] and [ (Shift: to the end) | Bring forward, send backward | — |
| + and −, 0, 1, 2 | Zoom in and out, 100%, fit all, fit the selection | Same |
| V H R O D L A P T S F C | Tools: select, pan, rectangle, ellipse, diamond, line, arrow, draw, text, sticky note, frame, connector | Same |
| Escape | Cancel connecting, clear the selection, back to the select tool, then focus the surface | — |

`TOOL_KEYS` and `CANVAS_TOOLS` list the tools; `directionDelta` turns an
arrow (`Direction`) into a world delta; `KeyLike` is the key event shape.

Pointers: drag shapes to move them (with snapping guides; dropped wholly
inside a frame, they join it), drag the background to select with a
marquee (Shift adds), drag handles to resize (Shift keeps the aspect) and
the round handle to rotate (15° steps; Shift frees it), double-click to edit
text, draw with a shape tool, freehand with the draw tool, and connect by
dragging from one shape to another with the connector tool. The wheel pans;
Control or Command with the wheel zooms at the pointer; two fingers pinch.

## Accessibility

- The application region is named by the canvas title and described by
  the keyboard instructions. Each shape is an `img` (frames and groups a
  `group`) named by its text and state, with its kind as the role
  description.
- `CanvasShapeList` is a WAI-ARIA tree of every shape (frames and groups
  nest) and connector in reading order: Up and Down, Home and End, Right
  and Left open, close or go to the parent, Space toggles selection, Enter
  goes to the shape on the canvas, Delete removes it.
- Moves, resizes, rotations, selection, connections, zoom and refusals
  are announced through the shared live region of `@texuli/core/announcer`.
- Zoom and fit glide through the Web Animations runtime of
  `@texuli/core/motion` at the level of `texuli/motion`'s `MotionProvider`;
  reduced motion and level `none` are instant.
- Forced colors keep strokes, focus, selection and handles visible.

## Parts

`CanvasToolbar` (a WAI-ARIA toolbar: arrow keys between buttons, tools as
toggle buttons), `CanvasSurface` (`fitOnMount`, `trust`, `resolveImage`,
and children for overlays), `CanvasMinimap` (pointer only, hidden from
assistive technology), `CanvasShapeList` and `ShapeView` (one shape as SVG;
`ShapeFocus` makes it focusable) share a `CanvasController`.

## `CanvasController`

`new CanvasController(options)` (`CanvasControllerOptions`: `backend`,
`labels`, `readonly`, `dir`, `snap`, `onchange`, `announce`). A
`CanvasBackend` holds the document: `historyBackend(doc, trust)` (the local
op log) or `syncBackend(sync)`. The controller tracks `doc`, `view`,
`selection`, `focusId`, `tool`, `editing` and `connecting`, and runs every
command: `apply`, `undo`, `redo`, `select`, `toggle`, `step`, `nudge`,
`resizeBy`, `rotateBy`, `removeSelection`, `group`, `ungroup`, `reorder`,
`align`, `distribute`, `copy`, `cut`, `paste`, `duplicate`, `add`,
`createAt` (`DEFAULT_SIZES`), `startEdit`, `commitText`, `startConnect`,
`commitConnect`, `zoomIn`, `zoomOut`, `fit` and `reveal` (zoom stays within
`ZOOM_LIMITS`).

## Labels

`DEFAULT_CANVAS_LABELS` holds every string (`CanvasLabels`); each is a
`CanvasLabel` template or function of `CanvasLabelValues`.
`resolveCanvasLabels(overrides)` merges a locale's overrides;
`formatCanvasLabel` fills a template. All output is plain text.
