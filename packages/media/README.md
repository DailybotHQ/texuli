# @texuli/media

Media: images, galleries, video, audio and layered compositions. The L4
domain package composes `texuli` components, `@texuli/primitives` behavior
and the `@texuli/tokens` engine into Svelte 5 media surfaces. Published to npm as `0.1.0-next.2` under the `next`
dist-tag (by CI, with provenance); no stable release (`latest` is reserved
for 1.0.0), so install it with `@next`. The workspace package stays
`"private": true`.

## Status

Implemented in `src/` and exported through [`package.json`](package.json)
(the root and 22 subpaths): safe image and gallery rendering, video and audio
players, an image editor with crop presets, video trim and caption editing
recipes, the composition model (v1, and v2 with groups and layer timing) with
SVG and canvas renderers, keyframe animation with a timeline editor,
captions, export, and the
provider-neutral generator slot. They are covered by 72 unit tests in 16
files (`pnpm vitest run packages/media`).
Per-item notes live in [`docs/`](docs/) here until they are folded into this
README.

## Using the components

The package peers on Svelte 5 (`^5.57.2`); its `@texuli/*` dependencies are
workspace links. Media URLs are untrusted by default: every source passes the
core URL policy (`safeImageSrc`, `safeImageSrcset`, `safeMediaSrc`), and a
`trust` prop set to `developer` widens what a host-authored value may use.

```svelte
<script lang="ts">
  import { Image } from '@texuli/media/image';
</script>

<Image
  src="https://images.example.com/harbor.jpg"
  widths={[480, 960, 1600]}
  loader={(src, width) => `${src}?w=${width}`}
  sizes="(min-width: 48rem) 40rem, 100vw"
  alt="Fishing boats in a harbor at sunset"
  width={1600}
  height={900}
/>
```

## Areas

| Import | What it does | Documentation |
| --- | --- | --- |
| `@texuli/media/image` | Safe responsive `Image`: srcset, focal point, placeholders, lazy by default, labeled fallback | [Image](docs/image.md) |
| `@texuli/media/gallery` (+ `/lightbox`) | Grid or masonry `Gallery`; `Lightbox` modal viewer with keyboard, swipe and zoom | [Gallery and Lightbox](docs/gallery.md) |
| `@texuli/media/video` | Video player with track sources through the media URL policy | [Video player](docs/video.md) |
| `@texuli/media/audio` | Audio player and waveform | [Audio player and waveform](docs/audio.md) |
| `@texuli/media/image-editor` (+ `/model`, `/render`) | Image editor model and rendering | [Image editor](docs/image-editor.md) |
| `@texuli/media/composition-model` | The layered composition data model | — |
| `@texuli/media/composition-v2` | Groups and layer timing; resolves any instant to a flat v1 frame for every renderer and the WebM export | [Composition v2](docs/composition-v2.md) |
| `@texuli/media/timeline` (+ `/model`) | `AnimationTimeline` editor: layer windows, keyframes, playhead, preview, undo/redo; the framework-free edit model that keeps documents valid | [Animation timeline](docs/timeline.md) |
| `@texuli/media/composition-svg` | `CompositionSvg`, `renderCompositionSvg`, `compositionToSvgString` | [Composition SVG renderer](docs/composition-svg.md) |
| `@texuli/media/composition-canvas` (+ `/render`, `/draw`) | Canvas composition renderer and draw helpers | [Composition renderer: canvas](docs/media-composition-canvas.md) |
| `@texuli/media/animation` (+ `/player`) | Keyframe animation: `sampleComposition`, `validateAnimation`, `createTimeline`; `CompositionAnimationPlayer` on `/player` | [Composition keyframe animation](docs/animation.md) |
| `@texuli/media/captions` | Captions and chapters | [Captions and chapters](docs/captions.md) |
| `@texuli/media/export` (+ `/ui`) | Export functions (each loads on first call) and the `CompositionExport` control | [Media export](docs/media-export.md) |
| `@texuli/media/generator-slot` | Host-provided generation UI over a provider-neutral seam; Texuli ships no model and opens no network | [Generator slot](docs/generator-slot.md) |

`composition-model` has no doc page yet; its types are the source of truth.

## Planned

No roadmap item in this package is open as of 2026-10-26: composition v2
(groups and layer timing) and the animation timeline editor ship as the
`composition-v2` and `timeline` subpaths above. Image crop presets, video trim
recipes, caption cue editing, generation provenance display, provenance
sidecars on composition exports, WebM composition export, and the sequential
export queue with progress receipts are implemented too. Per-area limits stay
in each doc.

## Verification

```bash
pnpm vitest run packages/media       # 72 tests / 16 files
pnpm --filter @texuli/media typecheck  # exit 0
npx biome check packages/media       # exit 0
```

Browser behavior and size budgets live in the repository's
[testing guide](../../docs/TESTING_GUIDE.md).
