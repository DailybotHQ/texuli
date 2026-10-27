# Media export

**Package:** `@texuli/media` · **Entries:** `@texuli/media/export` (functions and the batch queue, 1.61 KiB; each exporter loads on first use) and `@texuli/media/export/ui` (the `CompositionExport` control, 4.12 KiB; `pnpm size`, 2026-10-25)

This exports a composition as **PNG** or **SVG**, and a composition animation as **WebM**, entirely in the browser. Nothing is uploaded and no network request is made, except loading image layers that pass the media URL policy.

```ts
import { downloadBlob, exportPng, exportQueue, exportSvg, exportWebm } from '@texuli/media/export';

const png = await exportPng(composition, { pixelRatio: 2, filename: 'poster' });
if (png.ok) downloadBlob(png.blob, png.filename);
```

`exportQueue` runs independent PNG, SVG, and WebM jobs sequentially. Its
progress callback receives privacy-safe receipts, while the aligned `results`
array contains the ordinary exporter results (including provenance sidecars):

```ts
const batch = await exportQueue(
  [
    { format: 'svg', input: poster, options: { filename: 'harbor-report' } },
    { format: 'png', input: poster, options: { filename: 'harbor-card', pixelRatio: 2 } },
  ],
  {
    signal,
    onProgress: ({ completed, total, progress, current }) => {
      console.log(`${completed}/${total}`, progress, current?.status);
    },
  }
);
```

Receipts have a queue-local deterministic id, format, state, progress fraction,
duration when an item ran, and a bounded failure reason. They contain no input
composition, source URL, file name, or caller metadata. They are returned for
this call and are not persisted. A failure does not stop later items. Aborting
stops the active cancellable export and marks queued items cancelled. The
`now` option is a monotonic clock seam for deterministic receipt tests. Results
are returned to the caller; the queue does not start downloads automatically.

```svelte
<script lang="ts">
  import { CompositionExport } from '@texuli/media/export/ui';
</script>

<CompositionExport {composition} {animation} filename="harbor-poster" background="#0f172a" />
```

## Formats

| Function | How | Result |
| --- | --- | --- |
| `exportSvg(input, options)` | Validates, then serializes the SVG renderer's tree with an XML declaration. Every text and attribute is escaped, and the file is not focusable | `{ ok, blob (image/svg+xml), svg, filename, width, height }` |
| `exportPng(input, options)` | Validates and draws with the canvas renderer on an offscreen canvas (a detached `<canvas>`, else `OffscreenCanvas`). It encodes with `toBlob` or `convertToBlob`. Options: `pixelRatio` (capped like the canvas view), `background`, `direction`, `fontFamily`, `loadImage`, `timeoutMs`, `signal` | `{ ok, blob (image/png), filename, width, height, refusedSources, failedSources }` |
| `exportWebm(composition, animation, options)` | Validates both documents and loads images once. It samples at deterministic timestamps with `sampleComposition`, draws with `drawComposition` to an owned canvas, and submits each frame to `canvas.captureStream(0)` via `requestFrame` and browser-native `MediaRecorder`. Its fixed profile is VP8 WebM at 4 Mbps; `fps` is 1–60 (default 30), `trim` is a validated source interval in milliseconds, and `pixelRatio`, `background`, `signal`, and `onProgress` are configurable. A 2 s animation takes about 2 s in real time. | `{ ok, blob (video/webm), mimeType, frames, filename, width, height, refusedSources, failedSources, provenance, sourceRange }` |
| `exportQueue(items, options)` | Runs the listed SVG, PNG, and WebM jobs in order. `signal` cancels queued work and active PNG/WebM work; `onProgress` receives an aggregate snapshot and per-item receipts. | `{ receipts, results }`; each receipt omits caller-provided content |

**Failures are reasons, never exceptions:**
- `invalid`, with the validator's errors. Animation paths are prefixed with `animation.`.
- `tainted`: a cross-origin image made the canvas unreadable.
- `unsupported`: no canvas, no capture, or no WebM recorder.
- `encode-failed` and `recorder-failed`.
- `aborted`.

Reduced motion does not apply to a WebM export: the file is the full animation the user asked for.
With `trim`, only that animation interval is rendered; clock deadlines are relative to the exported clip while sampling starts at the source interval's beginning. `CompositionExport` accepts the same trim prop.

**Format policy (D13, ADR-002): browser-native MediaRecorder only.** WebM uses
the fixed `video/webm;codecs=vp8` profile, 4 Mbps bitrate and 1-second chunk
interval; there is no MP4, WebCodecs, or bundled-encoder fallback. A
deterministic monotonic frame clock
prevents cumulative pacing drift. `onProgress` is monotonic and measures frames
submitted to the recorder, not final encoded-byte completion. Cancellation
clears any pending frame deadline, stops the recorder and all capture tracks,
and returns `aborted`. Missing capture/recorder support returns `unsupported`;
recorder start/stop failures return `recorder-failed`. Frame timing and profile
settings are repeatable within a browser, but encoded bytes are not promised to
be bit-identical across browser engines or hardware.

**Helpers:**
- `exportFilename(name, format)`: letters, digits, `.`, `_`, `-` and spaces only. Separators, control, bidi and reserved characters become `-`. It drops leading dots, keeps at most 80 characters, and always uses the format's extension.
- `downloadBlob(blob, filename)`: a temporary `<a download>`; the object URL is revoked after the click.
- `canExportWebm()`, `pickWebmMimeType(Recorder)` (the fixed VP8 WebM profile), `webmFrameTimes(durationMs, fps)`, and `browserWebmFrameClock` (injectable `WebmFrameClock` contract for deterministic tests).

## Untrusted input

- Every exporter runs `validateComposition` first, untrusted by default. An image `src` the media URL policy refuses (`javascript:`; and, for untrusted data, `data:`, `blob:` or `http:`) makes the document invalid, so nothing is fetched or drawn.
- The image loader checks each source again before requesting it, sends no referrer and asks for CORS, so a readable image keeps the canvas exportable.
- A non-CORS image fails to load and is listed in `failedSources`, rather than tainting the canvas.
- The SVG output contains only the escaped tree the SVG renderer builds; no `{@html}`, `innerHTML` or `eval` is involved.

## The control (`CompositionExport`)

- **Buttons.** One button per format; WebM appears only when an `animation` is given. These are real `<button>`s in a labelled group, so they are reachable and operable from the keyboard.
- **While an export runs.** It shows pending feedback (the texuli `Button` pattern), and the other buttons are disabled.
- **WebM recording.** It shows a labelled `<progress>` and a **Cancel recording** button, which aborts through an `AbortController`.
- **Results.** The result is announced in a polite `status` region: the saved filename, how many images were left out, or why nothing was made.
- **No WebM recorder.** Where the browser cannot record WebM, the button is disabled and described by a visible note.
- **Labels.** Every visible or announced string is translatable through `labels`. `onexport` reports each saved file.
- **Loading.** The exporters load on first use, so the control's chunk is small.

## Color keyframes (animation model)

`LayerKeyframe` gains `fill` and `stroke`. Each is a hex color in one of the forms the composition model accepts: `#rgb`, `#rgba`, `#rrggbb` or `#rrggbbaa`.
- `fill` animates a shape's fill or a text layer's paint.
- `stroke` animates a shape's stroke.
- Given the composition, `validateAnimation` rejects `fill` on an image layer and `stroke` on anything but a shape.

**Mixing.** Colors between keyframes mix in OKLCH (`mixOklch`):
- the hue takes the shorter way round;
- a gray end borrows the other end's hue;
- alpha mixes linearly;
- an out-of-gamut mix keeps its lightness and hue and loses chroma until it fits.

**Paint.** The sampled layer gets a solid paint.
- A layer whose paint is solid starts from that color.
- A layer with a gradient (or no paint) keeps it until its first color keyframe.

The SVG player, the canvas view and all three exports show the same colors.

## Verified

- `pnpm vitest run packages/media/tests/export.test.ts`: 7 tests.
  - Filenames: path traversal, Windows paths, bidi, control characters, length, extensions.
  - SVG: escaping, no `<script>`; unsafe `javascript:`, `data:` and `http:` sources refused, developer trust allowed.
  - PNG: pixel ratio, background, failed images, unsafe sources never fetched, tainted, encode failure, `OffscreenCanvas`, abort.
  - WebM: frame count, explicit frame deadlines, submitted-frame monotonic progress, fixed VP8/4 Mbps/1-second-chunk profile, `requestFrame` calls, OKLCH colors reaching the canvas, invalid or mismatched animation, unsafe source, unsupported paths, cancellation during a pending deadline, recorder failures, frame times, fixed MIME choice.
  - `downloadBlob`.
  - The control: keyboard button and announcement, the invalid message, WebM disabled with a reason, label merging.
- `pnpm vitest run packages/media/tests/export-queue.test.ts`: 1 test.
  - Ordered batch completion, aggregate progress, deterministic duration, and receipts without request content.
  - Failed item continuation, cancellation before start, and abort during the active item with queued work cancelled.
- `packages/media/tests/animation-color.test.ts`: 2 tests (mixing, gamut, hue path, alpha, validation by layer type, sampling for shapes, text and gradients).
- In real browsers (Chromium, WebKit, Pixel 7; scratch Playwright spec on port 4810):
  - axe passes in light, dark and forced colors.
  - Pressing Enter on **Export SVG** downloads `harbor-poster.svg`, which starts with `<?xml`.
  - **Export PNG** downloads a real PNG of 960 × 480 (signature and IHDR checked).
  - The unsafe composition announces why it was not exported.
  - **Export WebM** downloads a real WebM file (EBML signature `1A 45 DF A3`) in all three browsers.
- Visual baselines: `media-export`, light and dark, on Chromium and the Pixel 7.

## Limits

- **WebM support.** WebM needs `MediaRecorder` with VP8 WebM support and `canvas.captureStream`; other browsers get `unsupported`. Recording runs in real time and has no audio.
- **Execution boundary.** Frame drawing and encoding stay in the browser page. The exporter starts no worker and makes no upload or worker-network request.
- **SVG export.** It keeps `https:` image layers as links, so the file loads them when opened. They are not embedded.
- **Text measurement.** PNG and WebM text uses the page's fonts, while SVG text is laid out by whatever opens the file.
