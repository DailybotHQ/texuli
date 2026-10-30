# `@texuli/canvas/host`

Agents emit canvases as data: blueprint spec `0.8.0` adds an
agent-emittable `canvas` catalog id whose `canvas` prop holds a canvas.
`@texuli/catalog`'s `validateDraft` refuses a `canvas` node unless the host
supplies a canvas check (`checkCanvas`), and `@texuli/player` paints a
valid `canvas` root through its `canvasHost` seam. This subpath supplies
both. The player (L7) could import this package (L4), but the seam keeps
the canvas engine out of the player's first-load chunk, as the document
host does.

> **Status: in development.** On npm from `0.8.0`, the package's first
> release (pre-1.0).

```svelte
<script lang="ts">
  import { createCanvasPlayerHost } from '@texuli/canvas/host';
  import { Player } from '@texuli/player';

  const canvasHost = createCanvasPlayerHost({ resolveImage: (ref) => `/assets/${ref}.png` });
  let { draft }: { draft: unknown } = $props();
</script>

<Player blueprint={draft} {canvasHost} />
```

- `checkCanvasDraft` is a `CanvasDraftCheck`: `validateCanvas` at the
  player's tier (`CanvasHostTier`, the host's, never the draft's); every
  error refuses the node and is reported as a `CanvasDraftIssue` with a JSON
  path.
- `createCanvasPlayerHost(options)` (`CanvasHostOptions`: `resolveImage`,
  `labels`, `dir`) returns a `CanvasHost`: `checkCanvas` joins validation,
  and `present(request)` (`CanvasHostRequest`) validates again at the tier
  and mounts `CanvasViewer` into the player's surface, loading it on first
  use. A canvas that does not validate paints nothing; the cleanup unmounts
  the viewer.

The Kotlin twin validates `canvas` nodes (the envelope check, as for
documents) and paints an `unsupported` placeholder: native painting is
planned.
