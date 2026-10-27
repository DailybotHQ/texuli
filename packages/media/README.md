# @texuli/media

Media components for Svelte 5: safe responsive images, galleries with a
lightbox, accessible video and audio players, WebVTT captions and chapters,
an image editor, and a layered composition model with SVG and canvas
renderers, keyframe animation, a timeline editor and in-browser PNG, SVG and
WebM export. Every media URL passes a URL policy before it reaches the page,
so the components are safe to point at user or agent content. It is part of
[Texuli](https://texuli.com), "Small pieces. Infinite possibilities.": an MIT
Svelte 5 component library by Dailybot, Inc.

> **Status: 0.x release.** `@texuli/media` is published on npm as `0.2.0`, a
> pre-1.0 release (1.0.0 will be the first stable release). Under 0.x, a new
> minor (`0.3.0`) may contain breaking changes, so pin the exact version or
> use `^0.2.0`, which accepts only 0.2.x.

## Install

```sh
npm install @texuli/media @texuli/tokens svelte
```

- `svelte` (^5.57.2) is a peer dependency.
- The components style themselves with the Texuli `--tx-*` design tokens.
  Import the token stylesheet once in your app (installing `@texuli/tokens`
  directly lets your bundler resolve it); each component imports its own CSS.

```css
@import '@texuli/tokens/base.css';
```

## Quick start

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

`Image` builds the `srcset` from `widths` and your `loader`, reserves space
from `width` and `height`, loads lazily by default, and shows a labeled
fallback when a source is rejected or fails to load.

Sources are treated as **untrusted** by default. For URLs your own code
authors, pass `trust="developer"` to allow the wider developer tier.

## What's inside

**Components:**

| Import | What it gives you |
| --- | --- |
| `@texuli/media/image` | `Image`: srcset, focal point, placeholders, lazy loading and a labeled fallback |
| `@texuli/media/gallery` | `Gallery`: grid or masonry layouts of images |
| `@texuli/media/gallery/lightbox` | `Lightbox`: a modal viewer with keyboard, swipe and zoom |
| `@texuli/media/video` | `VideoPlayer` with custom accessible controls, and `VideoEditPanel` for trim and caption editing |
| `@texuli/media/audio` | `AudioPlayer` and `Waveform` |
| `@texuli/media/captions` | WebVTT captions and chapters: chapter menu, transcript view and active cue |
| `@texuli/media/image-editor` | `ImageEditor`: crop (with presets), rotate, flip, resize, adjust and annotate, exported as PNG, JPEG or WebP |
| `@texuli/media/generator-slot` | `GeneratorSlot`: UI for a media generator your app provides |

**Compositions** (layered, serializable documents):

| Import | What it gives you |
| --- | --- |
| `@texuli/media/composition-model` | The composition types, validation and provenance collection |
| `@texuli/media/composition-v2` | Groups and layer timing; resolves any instant to a flat frame |
| `@texuli/media/composition-svg` | `CompositionSvg`, `renderCompositionSvg` and `compositionToSvgString` |
| `@texuli/media/composition-canvas` | A canvas renderer for compositions |
| `@texuli/media/composition-canvas/render`, `@texuli/media/composition-canvas/draw` | The canvas render entry and its lower-level draw pipeline |
| `@texuli/media/animation` | Keyframes and easing: `sampleComposition`, `validateAnimation`, `createTimeline` |
| `@texuli/media/animation/player` | `CompositionAnimationPlayer` for playback |
| `@texuli/media/timeline` | `AnimationTimeline`: layer windows, keyframes, playhead, preview, undo and redo |
| `@texuli/media/timeline/model` | The framework-free edit model behind the timeline editor |
| `@texuli/media/export` | `exportPng`, `exportSvg`, `exportWebm`, `exportQueue` and `downloadBlob`; each exporter loads on first use |
| `@texuli/media/export/ui` | `CompositionExport`, a ready-made export control |

**Models without the UI:** `@texuli/media/image-editor/model` (the
serializable edit recipe) and `@texuli/media/image-editor/render`. The package
root, `@texuli/media`, re-exports the framework-free models and helpers.

## Key guarantees

- **URL policy on every source.** Images, srcsets, video, audio and track
  URLs pass the Texuli URL policy (`safeImageSrc`, `safeImageSrcset`,
  `safeMediaSrc`) at the `untrusted` tier unless you opt into `developer`.
- **No HTML sinks.** Caption cue text is stripped to plain text and rendered
  as text; nothing is injected as HTML.
- **No network of its own.** Export runs entirely in the browser and uploads
  nothing. The generator slot ships no model and opens no connection; your
  app supplies the generator, and its results pass the URL policy before
  display.
- **Accessible players.** Video and audio use custom controls with labels
  and keyboard support; caption UI loads only when tracks are passed.
- **Reduced motion.** The gallery and lightbox respect
  `prefers-reduced-motion`, and the animation sampler can hold a still frame.
- **Non-destructive editing.** Image edits are a small, serializable recipe
  applied to the untouched source, so they can be saved, validated and
  reopened.

## Documentation

- Site: [texuli.com](https://texuli.com) and the
  [media page](https://texuli.com/media-page/)
- Components:
  [image](https://github.com/DailybotHQ/texuli/blob/main/packages/media/docs/image.md),
  [gallery and lightbox](https://github.com/DailybotHQ/texuli/blob/main/packages/media/docs/gallery.md),
  [video](https://github.com/DailybotHQ/texuli/blob/main/packages/media/docs/video.md),
  [audio and waveform](https://github.com/DailybotHQ/texuli/blob/main/packages/media/docs/audio.md),
  [captions and chapters](https://github.com/DailybotHQ/texuli/blob/main/packages/media/docs/captions.md),
  [image editor](https://github.com/DailybotHQ/texuli/blob/main/packages/media/docs/image-editor.md),
  [generator slot](https://github.com/DailybotHQ/texuli/blob/main/packages/media/docs/generator-slot.md)
- Compositions:
  [composition v2](https://github.com/DailybotHQ/texuli/blob/main/packages/media/docs/composition-v2.md),
  [SVG renderer](https://github.com/DailybotHQ/texuli/blob/main/packages/media/docs/composition-svg.md),
  [canvas renderer](https://github.com/DailybotHQ/texuli/blob/main/packages/media/docs/media-composition-canvas.md),
  [keyframe animation](https://github.com/DailybotHQ/texuli/blob/main/packages/media/docs/animation.md),
  [animation timeline](https://github.com/DailybotHQ/texuli/blob/main/packages/media/docs/timeline.md),
  [export](https://github.com/DailybotHQ/texuli/blob/main/packages/media/docs/media-export.md)
- Source: [github.com/DailybotHQ/texuli](https://github.com/DailybotHQ/texuli)
  · Issues: [github.com/DailybotHQ/texuli/issues](https://github.com/DailybotHQ/texuli/issues)

## Contributing

Contributions are welcome; start at the
[GitHub repository](https://github.com/DailybotHQ/texuli).

## License

MIT © Dailybot, Inc.
