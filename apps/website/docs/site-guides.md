# texuli.com: Guides

**App:** `apps/website`  
**Surface:** `src/components/guides/`, `src/pages/guides/`  
**Tests:** `tests/e2e/site-guides.spec.ts`, `scripts/tests/site-loaders.test.ts`

## Goal

Product guides for getting started (install or copy), theming, dark mode,
accessibility, RTL and i18n, forms and performance. Every page includes a
**live** Texuli snippet that actually runs. Static output, no runtime network
beyond the page’s own assets, axe WCAG 2.1 A/AA in light and dark (the page
sweep, `a11y-site-<n>.spec.ts`).

## Components

| File | Role |
| --- | --- |
| `nav.ts` | `GUIDES_SECTIONS`, `guidesPager`, flatten helpers |
| `GuidesShell.astro` | Docs-shell chrome wired to the guides tree |
| `GuideCode.astro` | Static code region (text only) |
| `*Live.svelte` | Interactive islands (Button, Field, Form, RTL, tokens) |

Reuses `DocsSidebar`, `DocsMobileNav`, `DocsToc` and `DocsPager` with a
`sections` prop so guides do not fork the shell.

## Pages

| Path | Title |
| --- | --- |
| `/guides/` | Overview |
| `/guides/getting-started/` | Getting started |
| `/guides/theming/` | Theming |
| `/guides/dark-mode/` | Dark mode |
| `/guides/accessibility/` | Accessibility |
| `/guides/rtl-i18n/` | RTL and i18n |
| `/guides/forms/` | Forms |
| `/guides/performance/` | Performance |

## Navigation

Site header `NAV` includes **Guides** (`/guides/`).

## Validation

```bash
bash -c 'pnpm build && TEXULI_E2E_PORT=4940 pnpm exec playwright test tests/e2e/site-guides.spec.ts'
pnpm vitest run scripts/tests/site-loaders.test.ts
```

The e2e spec (one test since the 2026-10-27 trim) serves `apps/website/dist`
on a free port: the sidebar marks the page, the pager walks the reading order,
and the live snippets respond (a button, form validation, the direction
switch). The reading order, the live islands and the contents are
unit-tested in `apps/website/tests/docs-reading.test.ts`.

## Limits

- TOC entries are authored per page.
- Live demos use fictional `@example.com` data only.
- Contrast gates are WCAG 2.x (APCA out of scope).
