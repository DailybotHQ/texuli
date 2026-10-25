# Media blocks

**Package:** `@texuli/blocks` · **Import:** `@texuli/blocks/media` (lazy) or `@texuli/blocks/media/renderers` (eager)

The media family renders `image`, `figure`, `video` and `gallery` from **untrusted data**. Every block passes `safeParseBlock` / `checkMediaBlock` before anything paints. Rejected blocks become an inert, translatable notice.

## Sources

Block media never loads remote URLs. Allowed sources (via `classifyMediaSource`):

| Kind | Image | Video |
| --- | --- | --- |
| `avatar:av-001`…`av-175` | yes (host `resolveAvatar`) | no |
| `data:image/png\|jpeg\|webp\|gif;base64,…` | yes (≤ 192 KB decoded) | — |
| `data:video/mp4\|webm;base64,…` | — | yes (≤ 192 KB) |
| Relative path (`assets/cover.webp`, `./clips/demo.mp4`) | raster extensions only | mp4/webm |

SVG, `https:`, `javascript:` and protocol-relative URLs are refused at parse time.

## Entry points

| Import | What it gives you |
| --- | --- |
| `@texuli/blocks` | `loadMediaFamily()`, `checkMediaBlock`, `isMediaFamilyBlock`, `MEDIA_BLOCK_TYPES` |
| `@texuli/blocks/media` | the above plus labels and `resolveBlockMediaSrc` |
| `@texuli/blocks/media/renderers` | `MediaBlockView` (eager) |

```svelte
<script lang="ts">
  import { loadMediaFamily } from '@texuli/blocks';
  let { block }: { block: unknown } = $props();
</script>

{#await loadMediaFamily() then { default: MediaBlockView }}
  <MediaBlockView {block} />
{/await}
```

## Blocks

| Type | Notes |
| --- | --- |
| `image` | `alt` required unless `decorative: true`; optional caption/credit; `fit` cover\|contain |
| `figure` | same as image with **required** caption |
| `video` | required `label`; optional poster; autoplay requires `muted: true`; respects reduced motion |
| `gallery` | 1–12 items; optional `title` and `columns` 2–4 |

## Styles

Component-scoped CSS with logical properties and forced-colors borders. No static `style=` on fixed chrome; gallery column count uses a validated CSS custom property.
