# texuli.com: brand and home page

**App:** `apps/website`  
**Pages:** `/` (home), `/brand/`  
**Components:** `src/components/brand/`  
**Tests:** `apps/website/tests/brand.test.ts`; axe and polish in the page sweep, `tests/e2e/a11y-site-<n>.spec.ts`

## Goal

Home and brand pages tell the Texuli story:

- Tagline: **Small pieces. Infinite possibilities.**
- **Texels → Texuli → Interfaces** with live Button, Badge and Card (SSR)
- What Texuli is, why owned primitives, why agents
- Live demos of real components
- Static output, no runtime network, axe clean in light and dark (the page sweep)

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
pnpm vitest run apps/website/tests/brand.test.ts
pnpm build
TEXULI_E2E_PORT=<port> pnpm exec playwright test tests/e2e/a11y-site-1.spec.ts tests/e2e/a11y-site-2.spec.ts tests/e2e/a11y-site-3.spec.ts
```

The brand page has no spec of its own since the 2026-10-27 trim: its assets and
surfaces are unit-tested, and the sweep serves `apps/website/dist` for axe.
