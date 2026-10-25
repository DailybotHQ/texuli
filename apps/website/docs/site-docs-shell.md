# Docs shell (texuli.com)

**App:** `apps/website`  
**Surface:** `src/components/docs-shell/`, `src/pages/docs-shell/`  
**Tests:** `tests/e2e/site-docs-shell.spec.ts`

## Goal

A static documentation layout with:

- section **sidebar** (desktop)
- **mobile** navigation (`details` / `summary`, no island)
- on-page **table of contents**
- **previous / next** pager
- **edit-free** (no third-party edit links)
- no runtime network beyond the page’s own assets
- axe WCAG 2.1 A/AA in light and dark on desktop and Pixel 7

## Components

| File | Role |
| --- | --- |
| `nav.ts` | Closed docs tree, flatten, pager, path normalize |
| `DocsShell.astro` | Page frame on `BaseLayout` |
| `DocsSidebar.astro` | Sticky section nav |
| `DocsMobileNav.astro` | Narrow-viewport menu |
| `DocsToc.astro` | In-page outline |
| `DocsPager.astro` | Previous / next |

## Pages

| Path | Title |
| --- | --- |
| `/docs-shell/` | Docs shell |
| `/docs-shell/getting-started/` | Getting started |
| `/docs-shell/navigation/` | Navigation |

## Validation

```bash
bash -c 'pnpm build && TEXULI_E2E_PORT=4880 pnpm exec playwright test tests/e2e/site-docs-shell.spec.ts'
```

The spec serves `apps/website/dist` on a free port (same pattern as
`site-foundation.spec.ts`).

## Limits

- TOC entries are authored per page (not scraped from Markdown at build time).
- Mobile menu is progressive enhancement via native `details`, not the AppNav drawer.
