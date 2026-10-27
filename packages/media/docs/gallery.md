# Gallery and Lightbox

`Gallery` lays out images in a grid or masonry. Each tile opens `Lightbox`, a
modal viewer with keyboard, swipe and zoom. Every source passes the media
image URL policy. Added by T-media-gallery.

```svelte
<script lang="ts">
import { Gallery, type GalleryItem } from '@texuli/media/gallery';

const items: GalleryItem[] = [
  {
    src: 'https://images.example.com/harbor.jpg',
    thumbSrc: 'https://images.example.com/harbor-480.jpg',
    alt: 'Fishing boats in a harbor at sunset',
    width: 1600,
    height: 900,
    caption: 'Harbor at dusk',
  },
  // …
];
</script>

<Gallery {items} layout="masonry" aria-label="Trip photos" loop />
```

## Entry points

| Import | What |
| --- | --- |
| `@texuli/media/gallery` | `Gallery` and the model. The lightbox loads lazily on the first open. |
| `@texuli/media/gallery/lightbox` | `Lightbox` on its own (your own trigger), plus the model. |
| `@texuli/media` (root) | The framework-free model only: `resolveGalleryItems`, `masonryLayout`, `columnCount`, `stepViewable`, `swipeIntent`, `clampZoom`, `clampPan`, `GALLERY_LIMITS`, `DEFAULT_GALLERY_LABELS` and the types. |

Sizes are measured with `pnpm size` (gzip, Svelte external) on 2026-10-24:

| Entry | Initial | CSS | Loaded on first open |
| --- | ---: | ---: | ---: |
| `@texuli/media/gallery` | 7.02 KiB | 2.12 KiB | 14.58 KiB |
| `@texuli/media/gallery/lightbox` | 17.48 KiB | 1.23 KiB | — |

The lightbox is built on the owned Dialog primitive (11.71 KiB on its own). The
lightbox's own code is about 5.8 KiB of its 17.48 KiB. The standalone subpath
is above the default 12 KiB `@texuli/media/*` cap and within its own 18 KiB
budget.

## Items

A `GalleryItem` has these fields:
- `src` and `alt`, both required;
- `srcset` and `sizes`, for the lightbox;
- `thumbSrc` and `thumbSrcset`, for the tile;
- `width` and `height`;
- `caption`;
- `focalPoint` and `placeholder` (the same shapes as [`Image`](./image.md));
- `id`.

Items are untrusted input. `resolveGalleryItems(items, trust)` never throws:
- Entries that aren't objects are skipped, and the list is cut to 500.
- Captions are trimmed and cut to 500 characters.
- A missing or duplicate `id` falls back to the item's position.
- `src` and `thumbSrc` each go through the image policy. An unsafe thumbnail
  blocks the tile; it never falls back to the full source.

An item whose full `src` is blocked stays in place as a labeled fallback. It is
never requested, is not a button, and the lightbox skips it.

## Gallery props

| Prop | Default | Notes |
| --- | --- | --- |
| `items` | — | `GalleryItem[]` (validated as above). |
| `layout` | `grid` | `grid`: equal tiles, captions below. `masonry`: each tile keeps its image's shape, captions over the image. |
| `aspectRatio` | `1 / 1` | Grid tiles. Positive numbers only (`4 / 3`, `1.5`); anything else becomes `1 / 1`. |
| `minColumnWidth` | `180` | The narrowest column, in CSS pixels. |
| `columns` | `4` | Masonry: the most columns, capped at 12. |
| `gap` | `8` | Space between tiles, in CSS pixels (0–64). |
| `loading` | `lazy` | Tile image loading; use `eager` for a gallery above the fold. |
| `lightbox` | `true` | `false` renders plain tiles that open nothing. |
| `loop` | `false` | Whether the lightbox wraps from the last image to the first. |
| `bind:open`, `bind:index` | `false`, `0` | `index` is the item's position in `items`. |
| `onOpenChange`, `onIndexChange` | — | Called on changes made inside the gallery and lightbox. |
| `trust` | `untrusted` | `developer` also allows HTTP, blob URLs and bounded data images. |
| `labels` | English | `title`, `previous`, `next`, `zoomIn`, `zoomOut`, `resetZoom`, `close`, `position` (`{current} of {total}`), `open` (`Open image {current}`) and `unavailable`. |
| `aria-label` | — | Names the list. Recommended when a page has more than one gallery. |
| `class` | — | On the outer frame. |

`Lightbox` takes `items`, `bind:open`, `bind:index`, `loop`, `trust`,
`labels`, `class`, `onOpenChange`, `onIndexChange` and `returnFocus(index)`.
`returnFocus` returns the element to focus when the lightbox closes.

## Layout

- **Grid:** pure CSS, `repeat(auto-fill, minmax(min(100%, minColumnWidth), 1fr))`.
- **Masonry:**
  - `masonryLayout` packs each item, in order, into the shortest column. Ties
    go to the inline-start column, and the same items always give the same
    layout.
  - Tiles are placed with container query units, so the browser measures
    nothing per image.
  - The column count comes from the frame's inline size. It is measured once
    on mount, so the first paint is right. After that, a `ResizeObserver`
    applies a new width only once it has held for 120 ms, so a scrollbar
    toggle or a brief layout change, such as a full-page screenshot, does
    not re-pack the tiles.
  - An item without `width` and `height` is drawn square.
- **Order:** in both layouts, the DOM order, and so the Tab and reading order,
  is the item order.

## Lightbox behavior

- **Dialog:** a modal named by `labels.title`. It traps focus, makes the page
  inert, and locks scroll. Focus starts on Close. On close, the gallery
  returns focus to the tile of the last image shown, not the one opened.
- **Position:** "3 of 8" counts viewable images only, in a polite live region.
  The caption is the dialog's description.
- **Keyboard:**
  - ←/→ move to the previous or next image, mirrored in right-to-left
    layouts. Home and End jump to the first or last.
  - `+` or `=` zooms in, `-` zooms out, and `0` resets.
  - While zoomed, the arrow keys pan the image instead.
  - Escape closes.
  - The buttons declare their shortcuts with `aria-keyshortcuts`.
- **Pointer and touch:**
  - A horizontal swipe or mouse drag of at least 15% of the stage (40 px
    minimum), mostly horizontal, changes the image.
  - A double tap or double click toggles 200% zoom.
  - A pinch or the wheel zooms, from 100% to 400%. A drag pans a zoomed
    image, which is clamped so its edges stay outside the stage.
  - A tap on the empty stage beside the image closes.
- **Zoom on change:** each new image starts at 100%, centered.
- **Fallback:** an image that fails to load shows `labels.unavailable`, named
  by its `alt`.
- **Colors:**
  - The viewer is dark in every theme, with white controls: 2.75rem targets
    and a white-and-black focus ring.
  - Forced colors use system colors.
  - Reduced motion removes the zoom and hover transitions.

## Verification

- **Unit tests:** `pnpm vitest run packages/media/tests/gallery.test.ts` has
  4 tests. They cover the model and the components: the URL policy, malformed
  input, masonry packing, navigation, gestures, zoom, focus return and the
  error fallback. Ten deliberate code breaks each fail a test.
- **Real browsers:** an ad-hoc Playwright run on Chromium, WebKit and Pixel 7
  (lane N, not committed) passed:
  - axe reported no violations for the three examples and the open lightbox,
    in light and dark, with forced colors on and off;
  - keyboard open, navigation, zoom, the Tab trap and focus return;
  - a mouse-drag swipe, the zoom buttons and a click to close;
  - a real touch tap and a CDP touch swipe on Pixel 7;
  - masonry tiles that never overlap, re-packing to 2 and then 1 column when
    the viewport narrows;
  - no request for any blocked source.

## Limits

- **No thumbnail strip** in the lightbox, and neighbor images are not
  preloaded.
- **Pinch zoom** scales around the image center, not the pinch point.
- **Masonry captions** sit over the image, because a tile's height is its
  image's.
- **Many tiles:** every tile is a Tab stop; there is no roving focus. For very
  large sets, page the items (the list is capped at 500).
- **Firefox** was not checked (it does not launch on this machine).
