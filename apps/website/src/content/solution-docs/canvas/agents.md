## Untrusted canvases

A canvas from an agent, a file or a share link is untrusted data. Use `loadUntrustedCanvas` or `validateCanvas` from `@texuli/canvas/model` before any deep work. Default URL policy is the untrusted tier. There is no HTML sink.

## Catalog and player

Agents emit canvases as data through the `canvas` catalog id (blueprint spec `0.8.0`). `@texuli/catalog` `validateDraft` refuses a `canvas` node unless the host supplies `checkCanvas`. `@texuli/player` paints a valid canvas root through its `canvasHost` seam.

```ts
import { createCanvasPlayerHost } from '@texuli/canvas/host';

const canvasHost = createCanvasPlayerHost({ resolveImage: (ref) => `/assets/${ref}.png` });
```

Do not invent an MCP operation that is not in `@texuli/tools`. Native painting of agent canvases is planned.
