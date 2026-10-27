# Texuli brand assets

The Texuli mark is a "T" built from texels: small rounded squares that become
one solid piece, the way texels become components and components become
interfaces. Source artwork supplied by the project owner (2026-10-23).

| File | Use |
| --- | --- |
| `texuli-logo-light.png` / `-dark.png` | Mark plus wordmark (3332 × 972). `light` is black for light backgrounds; `dark` is white for dark backgrounds. |
| `texuli-isotype-light.png` / `-dark.png` | The mark alone (1024 × 1024). |
| `texuli-favicon-{light,dark}-{16..512}.png` | Favicons and app icons. |
| `texuli-apple-touch-icon-{light,dark}.png` | Apple touch icon (180 × 180). |

The website serves resized copies from `apps/website/public/brand/` through
`BrandLogo.astro` (switches with the color mode) and `BrandHead.astro`
(favicons, manifest, theme color). Keep the originals here as the source;
regenerate the web copies from them.

## Social card

`social/texuli-og-source.png` is the designed home-page social card ("Build
any interface."). The website build serves a 1200 × 630 crop of it
(`apps/website/src/components/seo/og-home.png`) as the home page's
`og:image`; every other page gets its own generated card.
