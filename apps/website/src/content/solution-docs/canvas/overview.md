## What Canvas is

Canvas is an embeddable whiteboard: `@texuli/canvas` holds a framework-free model of shapes, text, connectors, groups and frames, typed operations with an op log, CRDT collaboration on `@texuli/document/sync`, a Svelte 5 editor and viewer, and SVG or PNG export with no HTML sinks. The package is published as `0.17.3` and is **in development** (pre-1.0). Pin the exact version or use `^0.17.0`.

It is a board you embed. It does not host canvases, persist them, or serve images. The host app stores the document and resolves image refs.

## What you get

- A validated canvas as data (`format: "texuli-canvas"`, `formatVersion: 1`).
- Shapes, sticky notes, frames, groups, and connectors that route straight, elbow or curved.
- `CanvasEditor` and `CanvasViewer`, with keyboard navigation and a shape tree.
- Local collaboration through the document sync adapter, and `canvasToSvg` / `canvasToPng`.

There is no hosted realtime service. Persistence, transport and image hosting belong to the host.
