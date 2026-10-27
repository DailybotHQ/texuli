# Blocks and templates

**App:** `@texuli/website` (`apps/website`)  
**Paths:** `/blocks-page/` (all blocks) and `/blocks-page/<block>/` (one template per block)  
**E2E:** `tests/e2e/site-blocks-page.spec.ts`

## Goal

Copy-ready page sections built only with Texuli, each shown three ways:

1. **Live preview:** the section rendered in a dashed frame, a named region
   "<Block> preview".
2. **Install:** the `texuli add` command for the styled components its source
   imports, with a copy button.
3. **Source:** the exact Svelte file, collapsed in a `<details>`, with a copy
   button. It is read at build time, so what you copy is what renders.

| Block | Path | `texuli add` | Interactive |
| --- | --- | --- | --- |
| Hero | `/blocks-page/hero/` | `badge button` | — |
| Features | `/blocks-page/features/` | `card` | — |
| Pricing | `/blocks-page/pricing/` | `badge button card` | — |
| FAQ | `/blocks-page/faq/` | `tabs-accordion` | Accordion (hydrated when visible) |
| Sign in | `/blocks-page/auth/` | `button card field input` | Validation (hydrated when visible) |
| Footer | `/blocks-page/footer/` | nothing (plain markup on tokens) | — |

The sections use fictional Harbor Notes copy. Pricing keeps its prices as
integer cents. The sign-in form checks its fields and sends nothing.

## Implementation

- **Catalog:** `src/components/blocks-page/blocks.ts`. It holds the ids,
  titles, descriptions, source files and `add` ids, plus `addCommand`,
  `blockPath` and `importedTexuliIds`.
- **Sections:** `src/components/blocks-page/sections/*Section.svelte`. They
  import Texuli by public names (`texuli/button`, …), so they paste as-is into
  an app that has installed Texuli. After `texuli add`, point the imports at
  the copied files.
- **Sources:** `sources.ts` reads the section files as text with
  `import.meta.glob(..., { query: '?raw' })` at build time.
- **Frame:** `BlockFrame.astro` shows the preview region, the install command
  (texuli `Code` and `CopyButton`, hydrated on load) and the source.
  - Long source lines scroll inside a focusable, named region ("<Block> source
    code") for keyboard scrolling (WCAG 2.1.1, axe
    `scrollable-region-focusable`).
- **Pages:** `src/pages/blocks-page/index.astro` holds all blocks and a
  contents nav. `src/pages/blocks-page/[id].astro` gives one template page per
  block, with a breadcrumb.
- **Nav:** the `Blocks` link is in `src/components/foundation/site.ts`.

Section headings start at `h3`, under each block's `h2` on this site. Adjust
the heading levels to your page when you paste a section. The footer becomes
the `contentinfo` landmark when it is the page's last child.

## Validate

```bash
pnpm vitest run apps/website/tests/component-pages.test.ts
pnpm build
TEXULI_E2E_PORT=<your port> pnpm exec playwright test tests/e2e/site-blocks-page.spec.ts
```

The spec (one test since the 2026-10-27 trim) serves `apps/website/dist` on
an ephemeral port and checks, in one page session:
- **Copy buttons:** they put the command and the byte-identical source on the
  clipboard.
- **Interaction:** the FAQ accordion opens by keyboard, and the sign-in form
  shows its validation then a demo status without navigating.
- **Template pages:** every block's template page renders its preview.
- **Network:** no request leaves the origin.

The install commands against each source's imports and the add registry are
unit-tested in `apps/website/tests/component-pages.test.ts` (the `texuli add`
copy itself is tested in `packages/tools/tests/cli-add.test.ts`); axe in light
and dark runs on the index in the page sweep (`a11y-site.spec.ts`).

## Limits

- **Registry:** `texuli add` copies components, not sections, so a section is
  copied from its source; the command installs what it imports.
- **Path:** the URL matches the designed surface (`/blocks-page/`).
- **No forced-colors axe run** on this page.
