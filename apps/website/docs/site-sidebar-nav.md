# Site navigation and docs layout

**App:** `@texuli/website` (`apps/website`)  
**Paths:** every page except the home landing (see [site-ia.md](site-ia.md))  
**E2E:** `tests/e2e/site-docs-nav.spec.ts` (plus `a11y-site-<n>.spec.ts` for every page and `site-perf.spec.ts` for the JS budgets)

## What every docs page has

- **Slim header** (`foundation/SiteHeader.astro`): sticky and 56px high. It
  holds the Texuli mark and wordmark, the search trigger (`SiteSearch`, styled
  as a field with the ⌘K hint) and the light, dark and system switch. On phones
  it also holds the menu button. Below 30rem the search shows only its glyph,
  and the wordmark is visually hidden.
- **Sidebar** (`foundation/SiteSidebar.astro`): from 64rem up, a sticky column
  with its own scroll. It is Texuli's `Sidebar`, rendered at build time with no
  island.
  - Quiet uppercase group headings name their lists.
  - Items are plain text links.
  - The current page has `aria-current="page"`, a tinted background and a
    primary marker, and is scrolled into view on load.
  - A page without its own link (a showcase screen, say) marks its nearest
    listed ancestor as the current section.
- **Phone drawer:** below 64rem the menu button opens the same navigation in
  Texuli's `Sheet`.
  - **Lazy:** `foundation/site-drawer.ts` loads on the first press, so pages
    that never open it load no drawer code and no island.
  - **No duplicate:** the drawer moves the page's own navigation in and puts
    it back on close, so the page ships the links once.
  - **Focus:** focus is trapped while open. Escape or the close button closes
    it, and focus returns to the menu button. `aria-expanded` follows the
    drawer's state.

## Docs pages

`isDocsPath` in `foundation/nav-data.ts` chooses the reading layout. It covers
component and primitive pages and their indexes, guides, Skill and Foundation.
Galleries, studios and the showcase keep the wide layout. The home is a
landing outside the shell ([site-ia.md](site-ia.md)).

- **Reading width:** prose up to 46rem.
- **"On this page"** (`docs/PageToc.astro`):
  - It shows from 80rem up and lists the page's `h2` and `h3`.
  - Scroll-spy uses an `IntersectionObserver`, and the current entry gets
    `aria-current`.
  - It is one small module script, not an island. It stays hidden on pages
    with fewer than two headings.
- **Pager** (`docs/DocsPager.astro`): previous and next links in sidebar order
  (`rel="prev"`, `rel="next"`). Guides keep their own pager.
- **"Copy page"** (`docs/CopyPage.astro`):
  - It copies a Markdown rendition of the page built at build time
    (`docs/markdown.ts`): headings, prose, links, code, lists and tables. It
    leaves out controls, scripts and hidden text.
  - A status message announces the result.

## One source for the navigation

- **`foundation/site.ts` and `NAV_GROUPS`** hold the groups and their fixed
  links:
  - Get started;
  - Components;
  - Primitives;
  - Themes;
  - Agents;
  - Project.

  Islands import this file, so it never imports the catalog.
- **`foundation/nav-data.ts`** is imported only by `.astro` files at build time.
  - It expands Components from the catalog manifests and Primitives from the
    primitives page data, each sorted alphabetically.
  - It exports `SITE_NAV_ORDER` (the reading order), `navSections`, `pagerFor`
    and `isDocsPath`.

Add a page by adding a link to its group in `NAV_GROUPS`. Component and
primitive pages appear on their own.

## JavaScript

The header loads the search palette on first use, and the drawer loads on the
first press of the menu. Every docs page now ships less JavaScript than with
the old top navigation, with the same islands. The numbers are gzip, measured
in Chromium on the same tree before and after the change:

| Route | Top navigation | Docs shell |
| --- | ---: | ---: |
| `/component-pages/`, `/component-pages/button/` | 53.7 KB | 46.2 KB |
| `/gallery-components/` | 64.9 KB | 57.6 KB |

## Library changes it needed

- **`Sidebar`:**
  - `showIcons={false}` for text-only items;
  - `current: 'page' | 'section'` on items;
  - group labels that name their lists;
  - an active item with a tint and a primary marker (`Highlight` in forced
    colors).
- **`Command.Trigger`:** `icon` (a search glyph) and `collapse="narrow"`.
  Below 30rem only the glyph shows, and the label stays in the button as its
  accessible name (WCAG 2.5.3).
- **`ToggleGroup`:** `wrap` lets long rows wrap onto more lines, with outline
  items shown as separate chips. The component gallery's category and tag
  filters use it.

## Fixes the narrower content column exposed

- **Shrinkable grids:** the component pages, the gallery, the live examples
  and the theme studio now use `minmax(0, 1fr)` tracks, so a wide child wraps
  or scrolls instead of widening the page. Every built page fits Chromium's
  1280px viewport and the 412px Pixel 7 viewport with no horizontal scroll.
- **Scrolling regions:** the component page tables and the studio's output are
  focusable, named regions, so keyboards can scroll them.
- **Link color:** the site's link color is in the `tx.base` layer, so Texuli
  components that render links keep their own colors. Before, the hero block's
  "Start free" button failed contrast.

## Validate

```bash
pnpm build
TEXULI_E2E_PORT=<port> pnpm exec playwright test tests/e2e/site-docs-nav.spec.ts tests/e2e/a11y-site-1.spec.ts tests/e2e/a11y-site-2.spec.ts tests/e2e/a11y-site-3.spec.ts tests/e2e/site-perf.spec.ts
```

## Limits

- **TOC only on wide screens:** "On this page" shows from 80rem up. Narrower
  screens rely on the headings and the pager.
- **Approximate Markdown:** the copy is a rendition of the rendered HTML, not
  the page's source. Live previews copy as their text.
- **Search on first use:** the header ships only the search trigger and the
  ⌘/Ctrl+K shortcut. The palette and its static index
  (`search/SitePalette.svelte`) load on the first press, so the first search
  waits for one small same-origin request.
