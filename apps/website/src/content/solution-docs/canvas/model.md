## Format

The canonical document is data: `format`, `formatVersion`, optional `meta` and `grid`, then `shapes` and `connectors`. Array order is z-order. Coordinates are world units. Shape types include rect, ellipse, diamond, line, path, text, sticky, image, frame and group. Connectors route `straight`, `elbow` or `curved`. Styles are a closed token palette; raw CSS colors are refused.

```ts
import { applyCanvasOps, createCanvas, validateCanvas } from '@texuli/canvas/model';
```

`validateCanvas` and `loadUntrustedCanvas` refuse unknown keys, hostile text, image refs the URL policy rejects, and anything past `CANVAS_LIMITS`. Work is linear in the input. The model has no Svelte and no DOM.

## Operations

Typed operations have inverses. The op log is the single edit path: undo, transforms, grouping and clipboard all go through it. The clipboard is untrusted JSON: size-checked, then validated.
