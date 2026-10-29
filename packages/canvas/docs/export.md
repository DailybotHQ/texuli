# `@texuli/canvas/export`

Static output of a canvas with no HTML sinks.

> **Status: in development.** Not on npm yet (`0.0.0` placeholder).

```ts
import { canvasToPng, canvasToSvg } from '@texuli/canvas/export';

const svg = canvasToSvg(canvas, { resolveImage: (ref) => `https://cdn.example.com/${ref}.png` });
const png = await canvasToPng(canvas, { scale: 2 }); // browser only
```

## SVG

`canvasToSvg(doc, options)` returns SVG text (no XML declaration);
`canvasSvgElement` returns the same as a `@texuli/core/markup` tree, to embed
in another markup document. Every text and attribute is escaped by the
markup builders, element and attribute names pass an allowlist
(`SVG_ELEMENTS`), image URLs go through `imageUrl` (the URL policy) at the
tier, and colors are fixed (`EXPORT_PALETTE`: a file carries no theme).
Work is linear in the canvas.

`SvgExportOptions`: `trust` (default `untrusted`), `resolveImage` (without
it, images export as their alt text), `padding` (default 24), `background`
(a white rectangle, default true), `dir`, and `ids` (export only those
shapes and the connectors between them).

## PNG

`canvasToPng(doc, options)` rasterizes the SVG on a canvas element in the
browser and resolves a PNG `Blob`; it rejects outside a browser.
`PngExportOptions` adds `scale` (default 2, at most 4) and `maxPixels`
(default 8,192 per side). The SVG reaches the image through an object URL,
never through markup. Images on other origins taint the canvas and the
browser refuses to encode it: resolve images to same-origin or `data:`
URLs for PNG export.
