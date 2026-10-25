# OKLCH palette engine

`@texuli/tokens/palette` provides deterministic color conversion, WCAG 2.x
contrast math, seed scales, and chart palette derivation. The engine is
framework-free and uses no schema library, theme catalog, or runtime
dependencies.

**Prefer the subpath** when a host only needs palette math (for example
Protoyard’s `createThemeFromSeed` delegating to Texuli). Importing through the
root barrel can pull unused catalog graphs depending on the bundler; the
`./palette` entry never does.

```ts
import {
  contrastRatio,
  deriveChartTokens,
  generatePaletteScale,
  oklchToHex,
  rgbToOklch,
} from '@texuli/tokens/palette';

const scale = generatePaletteScale('#2b6ce0');
const oklch = rgbToOklch([43, 108, 224]);
const fitted = oklchToHex({ l: oklch.l, c: 1, h: oklch.h });
const ratio = contrastRatio('#111827', '#ffffff');
```

## Color conversion and scales

- `rgbToOklch` converts an sRGB channel triplet (0–255) into D65 OKLCH.
- `oklchToHex` maps chroma into the sRGB gamut with a bounded binary search,
  clamps lightness into 0–1, and returns lowercase `#rrggbb`.
- Non-finite inputs and invalid negative chroma are rejected.
- `generatePaletteScale` accepts only `#rgb` and `#rrggbb` and returns the
  ordered steps `50` through `950`. The 11 lightness stops are fixed; chroma
  is capped to keep the generated scale in a practical range. Results are
  deterministic.

## Contrast and chart colors

`parseHex`, `relativeLuminance`, and `contrastRatio` implement WCAG 2.x
relative luminance for hexadecimal sRGB colors. Invalid colors are rejected
by the numeric functions rather than silently treated as black. `hoverFill`
finds a visible blackward or whiteward 14% mix when it preserves 4.5:1 against
its text color.

`deriveChartTokens(palette, mode)` returns eight categorical colors, a
nine-step sequential ramp, a nine-step diverging ramp, plus grid and axis
colors. It repairs data colors to at least 3:1 against the supplied valid
surface and background, separates categorical colors in OKLab and in
protanopia, deuteranopia, and tritanopia simulations, and checks ramp direction
and endpoint contrast. `validateChartTokens` returns an empty list when these
rules pass.

The chart derivation API is pure and deterministic. Its input palette is a
small token view (`ChartPaletteInput`), so this module does not depend on a
framework, the future theme contract, or the higher-level charts package.

## APCA

APCA support is not included in this implementation pending a licensing
review of the [official APCA-W3 terms](https://github.com/Myndex/SAPC-APCA/blob/master/LICENSE.md).
Do not use the WCAG 2.x ratio as if it were an APCA score; the two values are
different measures. The decision evidence is recorded in the PLAN_001 private
analysis output `APCA_TERMS_REVIEW.md`.
