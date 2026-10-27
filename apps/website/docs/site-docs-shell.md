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
- axe WCAG 2.1 A/AA in light and dark (the page sweep, `a11y-site.spec.ts`)

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

The spec (one test since the 2026-10-27 trim) serves `apps/website/dist` on a
free port and checks the current page mark, the contents jump, the pager in
reading order and, on a phone width, the `details` menu. The nav order is
unit-tested in `scripts/tests/site-loaders.test.ts`.

## Limits

- TOC entries are authored per page (not scraped from Markdown at build time).
- Mobile menu is progressive enhancement via native `details`, not the AppNav drawer.
