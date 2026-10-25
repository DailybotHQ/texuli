# Showcase: complete interfaces

**App:** `@texuli/website` (`apps/website`)  
**Paths:** `/showcase/` and `/showcase/<screen>/`  
**E2E:** `tests/e2e/site-showcase.spec.ts`

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
TEXULI_E2E_PORT=4920 pnpm exec playwright test tests/e2e/site-showcase.spec.ts
```

The spec serves `apps/website/dist` on an ephemeral port, asserts routes, no
foreign origins, and axe (WCAG 2.x A/AA) in light and dark on desktop Chromium
and Pixel 7.
