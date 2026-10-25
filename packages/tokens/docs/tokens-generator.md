# Theme generator

`@texuli/tokens/generator` builds a complete light and dark theme (every one of
the 50 semantic roles, with interaction states) from one brand color, from the
colors of an image, or from a few mood words. Every theme passes WCAG 2.x AA,
and the same input always gives the same theme. It is framework-free, makes no
network request, and reads no browser globals except the `document` you pass to
read an image.

```ts
import {
  generateThemeFromImage,
  generateThemeFromMood,
  generateThemeFromSeed,
  readImagePixels,
} from '@texuli/tokens/generator';
import { deriveChartTokens } from '@texuli/tokens';

const brand = generateThemeFromSeed({ seed: '#2b6ce0', neutral: 'slate' });
const calm = generateThemeFromMood('calm ocean');
const fromLogo = generateThemeFromImage(readImagePixels(logoImg, document));
const withCharts = generateThemeFromSeed({ seed: '#2b6ce0', deriveCharts: deriveChartTokens });
```

## From one color

`generateThemeFromSeed(options)` accepts:

| Option | Default | Meaning |
| --- | --- | --- |
| `seed` | required | The brand color, `#rgb` or `#rrggbb` |
| `secondary` | the seed's hue | A second brand color for secondary fills and the second chart series |
| `neutral` | `zinc` | Surfaces, text and borders: `zinc`, `slate`, `stone`, `gray`, `warm`, `cool` or `tinted` (the seed's own hue) |
| `contrast` | `AA` | `AAA` searches every text pair to 7:1 instead of 4.5:1 |
| `id`, `name`, `description` | from the seed | The theme contract's rules apply: a kebab id of at most 64 characters, a name of 1–40, a description of at most 200 |
| `radius`, `density` | contract defaults | A safe CSS length; 0.75–1.25 |
| `deriveCharts` | none | Pass `deriveChartTokens` to embed validated chart tokens in `theme.charts` |

How it builds a mode:

- **Neutrals.** Surfaces, borders and the sidebar sit at fixed OKLCH
  lightness in the chosen family's tint. Text colors (`foreground`,
  `mutedForeground`, `subtleForeground`, `sidebarForeground`) are searched,
  step by step in lightness, until they reach the text minimum against every
  surface they appear on.
- **Brand fill.** The primary keeps the seed when it already reads with white
  or near-black text. Otherwise its lightness moves the least needed. For
  example, `#2b6ce0` stays `#2b6ce0` in both modes. Fill lightness is kept
  between 0.35 and 0.75, so a very light seed (bright yellow, near white) is
  darkened enough to stay visible as a fill. A seed with almost no chroma
  (below 0.04) stays gray, and so do its secondary, accent and selection fills.
- **Status fills** (`destructive`, `success`, `warning`, `info`) use fixed hues.
  Each picks the text that reads better (white or near black), then searches
  the fill to the minimum.
- **Soft fills** (`secondary`, `accent`, `selection`) are light in light mode
  and dark in dark mode. Their text is searched against them.
- **Links, the focus ring and boundaries.** `link` and `linkVisited` (the brand
  hue shifted by 50°) reach the text minimum against background, surface,
  muted and elevated (the same surfaces `THEME_CONTRAST_PAIRS` gates). `ring`,
  `borderStrong` and `input` reach 3:1, the WCAG 1.4.11 non-text minimum.
- **Interaction states.** Every interactive role gets `hover` and `active`
  (lightness moved away from its text, which only raises contrast), `disabled`
  (pulled toward the background and desaturated) and `focus` (the ring).
- **Translucent layers.** `overlay`, `scrim` and `shadow` are translucent and
  outside the contrast checks.

After building, the generator checks every pair in `THEME_CONTRAST_PAIRS` in
both modes, including the hover and active states of filled roles. It throws
rather than return a theme that misses one. In a sweep of 5,194 themes (24 hues
× 5 lightness levels × 3 chroma levels, plus edge colors such as black, white,
pure yellow and near-white, × 7 neutral families × AA and AAA), none missed.

The theme is built directly in the contract's shape, with system font stacks
and the default style. `defineTheme(theme)` returns an identical theme, and a
test holds that. To change typography, shape or motion, pass the generated
theme through `defineTheme` with a `style`.

## Contrast checks

`THEME_CONTRAST_PAIRS` lists the guaranteed pairs:

- every foreground on the surfaces it appears on;
- every fill's text on the fill, including its hover and active states, for
  `primary` (and `sidebarPrimary`), `secondary`, `accent`, `destructive`,
  `success`, `warning` and `info`;
- `link` and `linkVisited` on background, surface, muted and elevated;
- the selection text on the selection;
- `borderStrong`, `input` and `ring` (non-text, 3:1) on the background and
  surface.

`checkPaletteContrast(palette, { textMinimum })` and
`checkThemeContrast(theme, { textMinimum })` return every pair that misses its
minimum, with the ratio. Colors that are not hex are skipped. They use the
WCAG 2.x ratio only: APCA is out of scope (its license is under review).

## From an image

1. `readImagePixels(image, document, maxSide = 96)` reads an image that is
   already loaded: an `<img>` from a file the user picked, a canvas or an
   `ImageBitmap`. It draws the image, scaled down, on a canvas from the
   `document` you pass and returns its `ImageData`. Nothing is fetched. An image
   without a size yet, a browser without a 2D canvas, and a cross-origin image
   without CORS (its canvas is tainted) each throw a `TypeError` that says
   which.
2. `dominantColors(pixels, { count = 5, alphaThreshold = 127, maxSamples = 20000 })`
   returns the most common colors with their share and OKLCH chroma.
   - Pixels at or below the alpha threshold are ignored.
   - Large images are sampled evenly.
   - Pixels are binned at 4 bits per channel, and near bins (OKLab distance
     below 0.08) are merged into the stronger one. Ties break on the bin, so the
     result depends only on the pixels.
3. `seedsFromColors(colors)` picks the seed with the most weight × chroma, so a
   large white or gray background does not beat the image's real colors. The
   secondary is the next color at least 30° of hue away. An image with no
   color gives a gray seed; an image with no opaque pixels throws.
4. `generateThemeFromImage(pixels, options)` chains these and accepts every
   seed option except `seed` and `secondary`.

## From mood words

`moodSeed(words)` maps English mood words (see `MOODS`) to a seed, a neutral
family, a radius and a density, and reports which words it recognized.
`generateThemeFromMood(words, options)` builds the theme. Options you pass
override what the words chose.

- Color words set a hue and chroma. Several hues are averaged around the color
  wheel, weighted by chroma, so red and violet blend through magenta, not
  green.
- Shape and spacing words (`playful`, `minimal`, `compact`, `spacious`…) set
  radius or density. The first word that sets each one wins.
- Text is split on anything that is not a letter, and case does not matter.
  Unknown words are ignored. Text with no known word gets a stable hue from a
  hash, so it is still deterministic.

## Limits

- Mood words are English only. A word that is not in `MOODS` contributes
  nothing, except the hash fallback when no word is known.
- Contrast is the WCAG 2.x ratio on hex colors. Translucent layers are not
  checked, and neither is perceptual quality.
- The generator does not emit CSS. Apply the theme with the tokens CSS helpers.

## Size

The `@texuli/tokens/generator` entry measures 7.05 KiB gzip with `pnpm size`
(2026-10-24), within the 8 KiB default for a tokens subpath. Chart derivation (about 3.8 KiB)
is injected through `deriveCharts` rather than bundled. The root
`@texuli/tokens` entry, which re-exports the generator and every other tokens
module, measures 39.42 KiB of its 49.69 KiB ceiling.
