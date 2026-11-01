# Illustrations on texuli.com

Every illustration on the site belongs to one family. They all follow the 3D texel style of the social image `brand/social/texuli-og-source.png`: small cubes stack into interfaces, which is Texuli's own idea ("Small pieces. Infinite possibilities.").

This guide fixes that style, the slot sizes and how a finished file reaches the page. The prompts that produce each image are generated into [illustration-prompts.md](illustration-prompts.md).

## Style

- **Camera.** Isometric three-quarter view, about 30°, with an orthographic feel and no perspective distortion. The subject is centred and floats slightly above a soft reflective floor that fades into the background.
- **Lighting.** Diffuse studio light from the top left, gentle ambient occlusion and soft contact shadows. No hard rim light, no lens flare, no bloom.
- **Materials.**
  - Rounded-edge cubes ("texels") in a soft clay or glossy-plastic finish.
  - Some cubes are frosted lilac glass.
  - Interface objects (browser window, phone, cards) are pearl-white panels with rounded corners and soft violet fills.
  - Thin dashed lilac connector lines link cubes to the objects they build.
- **Palette** (approximate hex values and the share of the image each takes):

  | Role | Hex | Share |
  | --- | --- | --- |
  | Pearl and off-white cubes and panels | `#F7F5FB` | about 60% |
  | Primary violet | `#6D4AFF` to `#7C5CFF` | about 25% |
  | Lilac glass and tints | `#B9A8FF` to `#E6DEFF` | about 10% |
  | Warm orange accent, a highlight only | `#FF8A4C` to `#FFA36B` | about 5% |
  | Background gradient | `#F4F0FF` (lavender) to `#FFF4EE` (peach) | the ground |

- **Interface glyphs.** Use simple shapes only: a mountain-and-sun image icon, bar and pie charts, a toggle, a gear, a 2×2 grid, a home glyph, and skeleton text lines (rounded bars) instead of words. Window chrome may show the three traffic-light dots.
- **Mood.** Friendly, premium, airy and modular: a calm product-marketing 3D image with generous negative space.

## Rules

1. **No text.** No letters, words, numbers, logos or watermarks anywhere in an image. The page's HTML carries every word, so statements stay readable, translatable and indexable. The one exception is the Texuli "T" isotype (a T built from square cells), allowed only as an embossed glyph on a single cube where the prompt says so.
2. **One idea per image.** Each image shows texel cubes plus one or two interface objects that tell the slot's single idea.
3. **No people, no robots, no photographs.** No dark or busy backgrounds, and no extra brand colours.
4. **Safe area.** Keep important content inside the central 84% of the frame. Leave 8% margins on every side, because crops and rounded frames clip the edges.
5. **Same light, same camera, same palette** in every image, so the set reads as one family.

## Light and dark

Each image is rendered on the light lavender-to-peach ground. On the light theme it sits flush, with no frame on `plate` variants. On the dark theme the same file sits in a rounded frame with a soft violet glow, so it reads as a lit product shot rather than a light patch on a dark page.

The files in the site today (added 2026-11-01) were generated with a transparent background instead of the gradient, so they sit on the page ground in both themes; the dark frame then only outlines them. `home-hero.webp` is the exception: it arrived without transparency, on a white ground, so it still shows as a white plate. Regenerating it with a transparent background replaces it with no code change.

A slot may also name an optional `fileDark` (the same scene on a deep violet-ink ground, about `#17142A` to `#221B3D`). When that file exists, the dark theme uses it instead of the frame. Dark variants are optional: the frame keeps every page correct without them.

## Slots and sizes

Slots are declared in `apps/website/src/data/illustrations.json`. Each entry has:

| Field | What it holds |
| --- | --- |
| `slot` | The slot id |
| `file` | A WebP name under `src/assets/illustrations/` |
| `fileDark` | Optional dark variant |
| `width`, `height` | The file's pixel size, which is also the rendered aspect ratio |
| `alt` | A literal description of the scene |
| `variant` | `banner`, `plate` or `band` |
| `priority` | Only the hero sets it (eager loading, high fetch priority) |
| `prompt` | The self-contained generation prompt |
| `model`, `created` | Provenance, filled in when a file lands |

| Use | Variant | Aspect | Pixel size |
| --- | --- | --- | --- |
| Landing hero | `plate` | 6:5 | 1200×1000 |
| Landing pitch | `plate` | 4:5 | 1040×1300 |
| Landing stories | `plate` | 16:10 | 1600×1000 |
| Landing quickstart | `plate` | 3:2 | 1200×800 |
| Landing final call to action | `band` | 16:7 | 1600×700 |
| Page banners | `banner` | 3:1 | 1920×640 |

Export WebP at quality 82 or better, at the exact pixel size above, below 250 KB for plates and bands and below 180 KB for banners. Generate at a larger size if the tool prefers, then downscale. Keep the alpha channel lossless: a lossy alpha draws visible steps in the soft shadows. With a lossless alpha, five banners exceed 180 KB (`page-agents` 182, `page-primitives` 187, `page-native` 188, `page-design-systems` 202 and `page-showcase` 264 KB, all at quality 82). The route budgets in `apps/website/src/components/perf/budgets.ts` count every image a page loads on open, which with `srcset` is the derived width, not the full file.

## Dropping in a file

1. Generate the image from its prompt in [illustration-prompts.md](illustration-prompts.md).
2. Save it as the slot's `file` (WebP, the exact size) in `apps/website/src/assets/illustrations/`. Save the optional dark variant as `fileDark`.
3. Optionally record `model` and `created` in the manifest entry.
4. Run `pnpm build`. The slot switches from its texel fallback to the file with no code change, and no layout shift, because the frame always reserves the same aspect ratio. The build also derives smaller WebP widths (quality 82, through Astro's image pipeline) and serves them with `srcset` and a per-variant `sizes`, so a page downloads about the width it shows; `illustrationWidths` and `ILLUSTRATION_SIZES` in `src/components/landing/illustrations.ts` set the steps.

Until a file exists, `SiteIllustration.astro` paints a seeded texel mosaic in the same palette roles, so a page is always complete.

Prompts live in each manifest entry's `prompt`. After editing one, regenerate the prompts doc (the website tests fail while it is stale):

```bash
pnpm exec tsx apps/website/scripts/illustration-prompts.ts
```
