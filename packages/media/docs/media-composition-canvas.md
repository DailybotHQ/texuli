# Composition renderer: canvas

**Package:** `@texuli/media` · **Subpaths:** `@texuli/media/composition-canvas`,
`…/composition-canvas/render`, `…/composition-canvas/draw` ·
**Path:** `src/composition-canvas/` · **Task:** T-media-composition-canvas

Draws a composition (`src/composition-model/`) on a `<canvas>`: large scenes,
masks and blend modes in one bitmap. For scenes that must keep text as text
(selectable, searchable, printable), use the SVG renderer instead.

## Use

```svelte
<script lang="ts">
import { CompositionCanvas } from '@texuli/media/composition-canvas';
let { scene } = $props(); // data from an agent, a file or a user
</script>

<CompositionCanvas composition={scene} label="Spring campaign poster" />
```

Without the component:

```ts
import { renderComposition } from '@texuli/media/composition-canvas/render';

const result = await renderComposition(canvasEl, untrustedData, { pixelRatio: devicePixelRatio });
if (!result.ok) console.warn(result.reason); // 'invalid' | 'unsupported' | 'aborted'
```

## Entries and sizes

Measured with `pnpm size` (gzip -9, Svelte external) on 2026-10-23; unchanged on 2026-10-24:

| Entry | Contents | Initial gzip |
| --- | --- | ---: |
| `@texuli/media/composition-canvas` | `CompositionCanvas`, geometry, view logic, labels, types | 4.37 KiB |
| `@texuli/media/composition-canvas/render` | `renderComposition`, with the validator. It loads the draw half lazily once data is accepted | 6.27 KiB |
| `@texuli/media/composition-canvas/draw` | `drawComposition`, `loadCompositionImages`, `imageElementLoader`, `defaultScratchFactory`, without the validator | 4.47 KiB |

`CompositionCanvas` loads the `render` and `draw` chunks on mount, in
parallel, and shows a loading status (`labels.loading`) until they arrive.
Use `draw` only for data you already validated, for example in a worker or an
exporter. Untrusted data goes through `renderComposition` or the component.

## Public API

| Export | Role |
| --- | --- |
| `CompositionCanvas` | Svelte 5 component: validates, renders, zoom/pan controls, accessible name and description. |
| `renderComposition(canvas, input, options?)` | Validate `unknown` input, size the canvas, load images, draw. Never throws for content. |
| `drawComposition(context, composition, options?)` | Paint an already validated composition on any 2D context. No DOM, no network; returns a `DrawReport`. |
| `loadCompositionImages(composition, options?)` | Vet every `src` with the media URL policy again, then load the distinct ones. Never rejects. |
| `describeComposition(composition)` | The text layers and image alt text, for assistive tech. |
| `canvasBackingSize`, `layerMatrix`, `layerBounds`, `linearGradientLine`, `radialGradientCircle`, `fitImage`, `wrapText` | The pure geometry, shared with other renderers and tests. |
| `viewportKeyAction`, `applyViewportAction`, `zoomViewport`, `panViewport`, `clampViewport` | Pure view logic behind the controls. |
| `DEFAULT_COMPOSITION_CANVAS_LABELS`, `resolveCompositionCanvasLabels` | Every visible or announced string, translatable. |

`CompositionCanvas` props: `composition` (unknown, validated), `trust`
(`untrusted` default), `label`, `labels`, `pixelRatio`, `dir`, `fontFamily`,
`background`, `loadImage`, `onrender`.

## Security (untrusted input)

- `renderComposition` and the component run `validateComposition` first, with
  `trust: 'untrusted'` by default. Rejected data is never drawn, measured or
  fetched; the component shows a note instead.
- Every image `src` passes `safeImageSrc` **again** before any request, with
  the same trust tier (defense in depth). Untrusted data may use `https:` and
  relative paths; `http:`, `blob:` and `data:` need `trust: 'developer'`.
  Executable schemes are always refused.
- The default loader sends **no referrer** and requests CORS (`anonymous`).
  Each image has a timeout (10 s default) and the load stops on abort.
- Text is painted with `fillText` and listed as Svelte text nodes. Nothing is
  parsed as markup; there is no HTML sink.

## Semantics (shared with the other composition renderers)

| Topic | Rule |
| --- | --- |
| Paint order | `layers[0]` is the bottom. |
| Transform | Applied around the **center of the layer's frame**: scale, then rotate, then translate (`translateX/Y` in composition units). |
| Masks | A layer referenced by any `mask.layerId` is a **mask source** and is not painted on its own. `alpha` uses the mask's alpha. `luminance` uses Rec. 709 luma of the sRGB values × alpha (white shows, black hides). `invert` keeps what the mask hides. Masks chain. |
| Opacity and blend | Applied when the (masked) layer is composited. `normal` is `source-over`; the other 15 modes use the canvas operation of the same name. |
| Linear gradient | CSS angle: `0` points up, clockwise. The line is long enough to reach the frame's corners. |
| Radial gradient | `center` is normalized to the frame; `radius` to the normalized diagonal `sqrt((w² + h²) / 2)`. |
| Line | From the frame's top-left to its bottom-right corner, stroked with `stroke`, or with `fill` when there is no stroke. `strokeWidth` defaults to 1, and 0 draws nothing. |
| Text | Wrapped to the frame width (spaces first, then between graphemes), line height 1.25 × font size, clipped to the frame. `align: start/end` follow `dir`. Default font `system-ui, sans-serif`. |
| Images | `fit` follows CSS `object-fit` (`cover` by default), clipped to the frame. |

## Large scenes

- **Culling:** layers whose transformed bounds miss the current view are not
  painted (`report.culled`).
- **Canvas limits:** the backing store is the composition size × pixel ratio,
  scaled down to fit 16,384 px per side and 16.7 megapixels (Safari's
  ceiling), so a large scene renders instead of going blank. The pixel ratio is
  capped at 4.
- **Zoom and pan:** the view redraws vectors at the new scale (it does not
  stretch a bitmap); zoom is 1–8×.
- **Image cache:** decoded images are reused across renders.

## Accessibility

- A `role="img"` wrapper carries the accessible name (`label`, or
  `labels.canvas`). Its description lists the scene's text and image alt text
  (`describeComposition`) plus a keyboard hint. A bitmap cannot expose these
  by itself.
- The view controls are native buttons: zoom out, zoom in, reset, and pan in
  four directions. While one has focus, `+`/`=` and `-` zoom, the arrow keys
  pan, and `0` or Home resets. Arrows pan in screen space, the same in RTL.
  Unavailable buttons use `aria-disabled`, so focus never jumps to the page.
- Zoom changes are announced in a `role="status"` region.
- Styles sit in `@layer tx.components` (consumer CSS wins), use logical
  properties, and switch to system colors under `forced-colors`.

## Verified

- `pnpm vitest run packages/media/tests/composition-canvas.test.ts`: 40 tests
  covering the geometry, the draw engine on a recording 2D context, the URL
  policy at load, render failures, the viewport and the component. Eight
  deliberate mutations of the implementation each fail a test.
- A pixel probe in real Chromium and WebKit (2026-10-23) checked:
  - the rotation about the center
  - multiply blend
  - alpha and inverted masks
  - the luminance fade
  - the CSS-angle gradient
  - RTL `start` text on the right
  - 2× backing store
  - a developer `data:` image drawn, and the same image refused as untrusted
- The `media-composition-canvas` example in the fixture app, in Chromium,
  WebKit and Pixel 7, light and dark:
  - axe reports 0 violations
  - there are no console errors and no external requests
  - keyboard zoom, pan and reset work, and 94 of 168 layers are culled when
    zoomed in

## Limits

- No animation yet: `durationMs` is ignored until the keyframe task adds a
  timeline.
- A luminance mask needs readable pixels. If an image inside the mask came
  from another origin without CORS, the mask falls back to its alpha channel
  (`report.warnings`: `luminance-as-alpha`).
- Text shaping and fonts are the browser's. Without a self-hosted font, the
  system font differs by platform, so pixel baselines are per platform.
- Hit testing and selection of layers are not part of this renderer.
