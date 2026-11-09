## Editor and viewer

`CanvasEditor` from `@texuli/canvas/editor` is the `role="application"` surface: toolbar, minimap, shape tree, pan, zoom, snapping and transforms. `CanvasViewer` from `@texuli/canvas/viewer` is read-only and exposes the structure as text.

Image refs are resolved by the host. Every URL passes `safeImageSrc` at the untrusted tier by default.

## Export

```ts
import { canvasToPng, canvasToSvg } from '@texuli/canvas/export';

const svg = canvasToSvg(canvas, { resolveImage: (ref) => `https://cdn.example.com/${ref}.png` });
const png = await canvasToPng(canvas, { scale: 2 });
```

`canvasToSvg` writes escaped markup through `@texuli/core/markup`. `canvasToPng` is browser-only.

## Sync

`@texuli/canvas/sync` binds the canvas to `@texuli/document/sync`. In-memory and `BroadcastChannel` adapters ship; a network transport is the host's. Collaboration is local or in memory, not a hosted service.
