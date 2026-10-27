# Showcase: complete interfaces

**App:** `@texuli/website` (`apps/website`)  
**Paths:** `/showcase/` and `/showcase/<screen>/`  
**Tests:** `apps/website/tests/gallery.test.ts` (screens and hero curation); axe and polish in the page sweep, `tests/e2e/a11y-site-<n>.spec.ts`

## Goal

Nine full example screens built **only with Texuli** components and tokens:

| Screen | Path |
| --- | --- |
| Index | `/showcase/` |
| Dashboard | `/showcase/dashboard/` |
| Settings | `/showcase/settings/` |
| Inbox | `/showcase/inbox/` |
| Kanban | `/showcase/kanban/` |
| Docs | `/showcase/docs/` |
| Landing | `/showcase/landing/` |
| Checkout | `/showcase/checkout/` |
| Media studio | `/showcase/media-studio/` |
| Slide deck | `/showcase/slide-deck/` |

Static Astro output. Fictional Harbor Notes copy. **No runtime network** after load
(theme CSS and bootstrap are inlined at build time).

## Implementation

- Catalog: `src/components/showcase/showcase.ts`
- Chrome: `ShowcaseChrome.svelte` (breadcrumb + title)
- Screens: `src/components/showcase/screens/*Screen.svelte`
- Pages: `src/pages/showcase/**/index.astro`
- Nav: `Showcase` link in `foundation/site.ts`

## Validate

```bash
pnpm build
TEXULI_E2E_PORT=<port> pnpm exec playwright test tests/e2e/a11y-site-1.spec.ts tests/e2e/a11y-site-2.spec.ts tests/e2e/a11y-site-3.spec.ts
```

The showcase has no spec of its own since the 2026-10-27 trim: the sweep runs
axe (zero exclusions), the polish check in light and dark, forced colors and a
keyboard walk on the showcase index (one page per route group), and `site-responsive.spec.ts` checks the index at 360 and 768 px.
