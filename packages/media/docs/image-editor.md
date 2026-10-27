# Image editor

**Package:** `@texuli/media` · **Path:** `src/image-editor/` · **Task:** T-media-image-editor

The editor crops, rotates, flips, resizes, adjusts and annotates an image
without changing it. An edit is a small, serializable recipe (`ImageEdit`)
applied to the untouched source. You can save it, validate it, re-open it,
undo and redo it, and export it as PNG, JPEG or WebP.

```svelte
<script lang="ts">
import { ImageEditor } from '@texuli/media/image-editor';
import type { ImageEdit } from '@texuli/media/image-editor';

let edit: ImageEdit | undefined = $state();
</script>

<ImageEditor
  src="https://images.example/harbor.jpg"
  alt="Fishing boats in a harbor at dawn"
  bind:value={edit}
  onexport={(result) => result.ok && save(result.blob, result.edit)}
/>
```

## Entries and sizes

Measured with `pnpm size` (gzip -9, Svelte external) on 2026-10-24.

| Entry | Contents | Initial gzip |
| --- | --- | ---: |
| `@texuli/media/image-editor` | `ImageEditor`, the labels, `describeEdit` and the types. The editor UI loads as a separate chunk when the component mounts (11.41 KiB lazy). | 7.36 KiB + 2.59 KiB CSS |
| `@texuli/media/image-editor/model` | The framework-free model: `validateImageEdit`, `applyEditAction`, the history reducer, geometry, `cssFilter`, the pixel filters and limits | 5.71 KiB |
| `@texuli/media/image-editor/render` | `loadEditableImage`, `drawImageEdit` and `exportImageEdit`, on any 2D context | 4.69 KiB |
| `@texuli/media` (root) | `createImageEdit`, `validateImageEdit`, `applyEditAction`, `createEditHistory`, `editHistoryReducer`, `IMAGE_EDIT_LIMITS` | root grew 12.10 → 15.57 KiB when the editor landed; the whole root is 36.48 KiB today (budget 48 KiB) |

## The edit

Rendering applies these steps in order:

1. **Orientation:** clockwise quarter turns (`rotate`: 0, 90, 180 or 270), then
   `flipX` and `flipY`.
2. **`crop`:** a normalized rectangle (0–1) in the oriented image. Omitted
   means the whole image. The smallest side is 1%.
3. **`resize`:** whole pixels. Omitted means the cropped size. The output is
   scaled down, keeping its aspect ratio, to at most 8,192 px per side and
   16,777,216 pixels in total.
4. **`filters`:** applied in this order:

   | Filter | Range | Neutral |
   | --- | --- | --- |
   | `brightness` | 0–200 % | 100 |
   | `contrast` | 0–200 % | 100 |
   | `saturation` | 0–200 % | 100 |
   | `grayscale` | 0–100 % | 0 |
   | `sepia` | 0–100 % | 0 |
   | `hueRotate` | −180–180° | 0 |
   | `blur` | 0–0.05 of the output's shorter side | 0 |

5. **`annotations`:** up to 50. Each is a `rect`, `ellipse`, `arrow` or `text`,
   with a six-digit hex `color` and a `strokeWidth` relative to the shorter
   side. Text is 1–280 characters with no control characters; its `fontSize`
   is relative to the output height, and it gets a contrasting halo so it
   reads on any photo. Positions are normalized on the final image.

Coordinates are normalized, so an edit works at any source resolution.

**Rotating and flipping carry the crop and the annotations with the picture**
(`applyEditAction` maps them through the same quarter turn or mirror). Rotating
a flipped image swaps `flipX` and `flipY`, which keeps the recipe minimal.
Changing the crop does not move the annotations: they stay at their normalized
positions on the new output.

## Untrusted input

- **Sources:** `src` goes through the media URL policy (`safeImageSrc`) before
  any request. Untrusted sources (the default) may use HTTPS or a relative
  path. `trust="developer"` also allows HTTP, blob and bounded `data:` images.
  A refused source is never requested: the editor shows "This image source is
  not allowed." (`role="alert"`). The default loader sends no referrer, asks
  for CORS (`anonymous`) and times out after 10 s.
- **Edit data:** an edit from storage, a file or an agent goes through
  `validateImageEdit`. It never throws, and it refuses the whole edit (never
  part of it), listing each problem with a JSON path. It rejects:
  - unknown fields, including `__proto__`;
  - non-finite or out-of-range numbers;
  - crops or frames outside the image;
  - non-integer or oversized `resize`;
  - colors that are not six-digit hex;
  - control characters in text;
  - duplicate annotation ids;
  - more than 50 annotations;
  - more than 64 KiB of JSON;
  - cyclic objects.

  An invalid `value` passed to the component fires `oninvalid(errors)` and the
  editor keeps its current edit.
- **No markup or style strings:** the CSS `filter` value is built only from
  validated numbers, and annotation text is painted with `fillText`. Nothing
  is parsed as markup.

## Rendering and export

- **Filters:** `drawImageEdit` uses `ctx.filter` where the engine honors it.
  Otherwise it applies the same filters in JavaScript: one color matrix built
  from the CSS Filter Effects definitions, plus a three-pass box blur that
  approximates the Gaussian `blur()`. Chromium and WebKit, as installed for
  Playwright here, both honor `ctx.filter`, so the fallback is exercised by
  unit tests only.
- **Unreadable pixels:** a cross-origin image without CORS cannot be read.
  Filters that need the fallback are then skipped (`filters: 'unavailable'`),
  and export returns `{ ok: false, reason: 'tainted' }`.
- **Export:** `exportImageEdit` renders at the output size and returns the
  `Blob` together with the edit, so the result can be re-edited. It never
  rejects; an engine that cannot encode gives `unsupported`.

## Accessibility and keyboard

- **Preview:** a `role="img"` named by `alt`. Its description summarizes the
  edit, for example "rotated 90°, 540 × 960 pixels, 2 adjustments,
  1 annotations".
- **Controls:** grouped in `fieldset`/`legend` (history, rotate and flip,
  crop, resize, adjust, annotate, export). The editor sets no heading levels,
  so it fits any page outline.
- **Every operation has a keyboard path:**
  - **Crop:** the four percent fields or the `Free`, `Square (1:1)`,
    `Landscape (16:9)` and `Portrait (9:16)` presets. Presets center-fit within
    the current crop using oriented source pixels. With "Edit crop" on, the crop
    box is focusable: the arrow keys move it by 1% (Alt: 0.1%), and Shift with an
    arrow key resizes it. The arrows are not mirrored in RTL, because image
    coordinates are physical.
  - **Annotations:** each one is a button in a list. The arrow keys move it
    by 1% (Shift: 5%), and Delete or Backspace removes it. Color swatches are
    named buttons with `aria-pressed`.
  - **Filters:** native range inputs with `aria-valuetext`.
  - **Undo and redo:** Ctrl/⌘+Z and Shift+Ctrl/⌘+Z (or Ctrl+Y), except
    inside text fields.
- **Pointer:** dragging moves or resizes the crop box, draws a new one, and
  moves annotations. Consecutive slider moves, crop nudges, moves and resizes
  merge into one undo step, and history keeps 100 steps.
- **Status:** the export result is announced in a `role="status"` region.
  `onstatus` reports `loading`, `ready`, `blocked` or `error`.
- **Styles:** in `@layer tx.components`, with logical properties, tokens with
  `light-dark()` fallbacks, and system colors under `forced-colors`. Buttons
  come from `texuli/button`. The area outside the crop is dimmed with
  `--tx-scrim`. The crop edge and handle sit on the photo rather than on a
  theme surface, so they default to a white edge with a black handle ring.
  Hosts can retune them with `--tx-image-editor-edge` and
  `--tx-image-editor-edge-contrast`.

## Labels

Every visible and announced string is in `DEFAULT_IMAGE_EDITOR_LABELS`. Override
any subset with the `labels` prop. `filters`, `add` and `types` merge key by
key. Placeholders such as `{width}` are filled as plain text.

## Verified

- `pnpm vitest run packages/media/tests/image-editor.test.ts`: 10 tests (2026-10-26) cover:
  - the model, the history and the validator against hostile edits;
  - the filter math against the CSS definitions, and the blur;
  - a geometric property: the source region under the crop stays the same
    through every rotation and flip, measured from the transform recorded on
    a 2D context double;
  - loading and the URL policy, drawing, export failures;
  - the component;
  - the stylesheet: chrome colors come only through `var()` tokens, and the
    crop dims with `--tx-scrim`.

  Ten deliberate mutations of the implementation each fail a test.
- In real Chromium, WebKit and Pixel 7 (2026-10-23), for the three examples
  (`media-image-editor`, `media-image-editor-edited`,
  `media-image-editor-blocked`):
  - axe reports 0 violations in light and dark, with and without forced
    colors;
  - the preview paints and follows a rotation;
  - grayscale turns every sampled pixel gray;
  - keyboard crop and annotation moves work;
  - a PNG export completes;
  - the blocked source is never requested;
  - there are no console errors.

## Limits

- **Rotation** is in quarter turns; there is no free-angle straighten yet.
- **Annotations** do not follow a crop change, and text is a single line.
- **Fonts:** text uses the system font unless `fontFamily` is set, so exported
  pixels differ slightly between platforms.
- **Cross-origin images** without CORS can be previewed but not exported.
