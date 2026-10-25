# texuli.com: brand and home page

**App:** `apps/website`  
**Pages:** `/` (home), `/brand/`  
**Components:** `src/components/brand/`  
**Tests:** `tests/e2e/site-brand.spec.ts`

## Goal

Home and brand pages tell the Texuli story:

- Tagline: **Small pieces. Infinite possibilities.**
- **Texels → Texuli → Interfaces** with live Button, Badge and Card (SSR)
- What Texuli is, why owned primitives, why agents
- Live demos of real components
- Static output, no runtime network, axe clean in light and dark (desktop + Pixel 7)

## Components

| File | Role |
| --- | --- |
| `BrandHero.astro` | Hero, tagline, CTAs |
| `StoryStrip.astro` | Three-stage story; stages 2–3 mount live Texuli components |
| `WhySections.astro` | Pillar cards (Card + Badge) |
| `LiveDemos.astro` | ButtonGroup, badges, card footer actions |

Motion is CSS-only (`prefers-reduced-motion: reduce` disables it). No client islands on these sections (only the site `ThemeSwitch` remains).

## Navigation

`NAV` in `foundation/site.ts` includes Home, Brand and Foundation.

## Validation

```bash
bash -c 'pnpm build && TEXULI_E2E_PORT=4930 pnpm exec playwright test tests/e2e/site-brand.spec.ts'
```

The spec serves `apps/website/dist` on a free port (same pattern as site-foundation).
