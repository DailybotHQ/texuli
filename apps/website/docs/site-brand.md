# texuli.com: brand page

**App:** `apps/website`  
**Pages:** `/brand/` (the home page is [site-landing.md](site-landing.md))  
**Components:** `src/components/brand/`  
**Tests:** `apps/website/tests/brand.test.ts`; axe and polish in the page sweep, `tests/e2e/a11y-site-<n>.spec.ts`

## Goal

The brand page tells the Texuli story and hands out the assets:

- Tagline: **Small pieces. Infinite possibilities.**
- **Texels → Texuli → Interfaces** with live Button, Badge and Card (SSR)
- What Texuli is, why owned primitives, why agents
- Live demos of real components
- Static output, no runtime network, axe clean in light and dark (the page sweep)

## Components

| File | Role |
| --- | --- |
| `StoryStrip.astro` | Three-stage story; stages 2–3 mount live Texuli components |
| `WhySections.astro` | Pillar cards (Card + Badge) |
| `LiveDemos.astro` | ButtonGroup, badges, card footer actions |

The page itself adds four sections after these: the mark (a T built from texels), color as a token story, voice, and a table of downloadable assets under `public/brand/`.

Motion is CSS-only (`prefers-reduced-motion: reduce` disables it). These sections add no client island.

## Navigation

`NAV` in `foundation/site.ts` includes Home, Brand and Foundation.

## Validation

```bash
pnpm vitest run apps/website/tests/brand.test.ts
pnpm build
TEXULI_E2E_PORT=<port> pnpm exec playwright test tests/e2e/a11y-site-1.spec.ts tests/e2e/a11y-site-2.spec.ts tests/e2e/a11y-site-3.spec.ts
```

The brand page has no spec of its own since the 2026-10-27 trim: its assets and
surfaces are unit-tested, and the sweep serves `apps/website/dist` for axe.
