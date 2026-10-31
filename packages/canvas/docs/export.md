# `@texuli/canvas/export`

Static output of a canvas with no HTML sinks.

> **Status: in development.** On npm from `0.8.0`, the package's first
> release (pre-1.0).

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
tier, and colors are concrete: the fixed `EXPORT_PALETTE`, or a design
system's values (`design`, below), since a file carries no custom
properties.
Work is linear in the canvas.

`SvgExportOptions`: `trust` (default `untrusted`), `resolveImage` (without
it, images export as their alt text), `padding` (default 24), `background`
(a white rectangle, default true), `dir`, `ids` (export only those
shapes and the connectors between them), and `design`.

## Design systems

`design` takes plain design values, a `CanvasExportDesign`: `colors` as
`#rrggbb` per role and `fonts.sans` as a CSS stack, built from a compiled
design system with `designValues(compiled, mode)` from
`@texuli/tools/print` (the canvas never imports `@texuli/tokens`).
`exportPalette(design)` maps each palette name through the role its
on-screen token reads (`EXPORT_DESIGN_ROLES`: `default` is `foreground`,
`gray` `mutedForeground`, `red` `destructive`, `orange` `warning`,
`green` `success`, `blue` `info`, and `yellow`, `teal`, `purple` and
`pink` the data-viz series `chart4`, `chart2`, `chart5` and `chart6`), so
strokes, tinted fills and text follow the brand. `background` fills the
background rectangle, `muted` and `border` paint the image placeholder,
and the text stack's plain names come first, then `system-ui,
sans-serif`. A value outside `#rrggbb` keeps its fixed color. Without
`design`, the SVG is byte-for-byte the fixed-palette output (a test pins
its SHA-256). PNG export takes the same option.

## PNG

`canvasToPng(doc, options)` rasterizes the SVG on a canvas element in the
browser and resolves a PNG `Blob`; it rejects outside a browser.
`PngExportOptions` adds `scale` (default 2, at most 4) and `maxPixels`
(default 8,192 per side). The SVG reaches the image through an object URL,
never through markup. Images on other origins taint the canvas and the
browser refuses to encode it: resolve images to same-origin or `data:`
URLs for PNG export.
