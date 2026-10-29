---
name: add-website-page
description: Add a page to texuli.com (apps/website, Astro 7 + Svelte islands) through BaseLayout and the nav source, so it gets SEO metadata, breadcrumbs, the sitemap, its Markdown twin, llms.txt and a covering build-time CSP, and passes the build and its specs.
version: "2.0.0"
user-invocable: true
allowed-tools: Bash, Read, Grep, Glob, Edit, Write
# === Documentation (ignored by harnesses, useful for humans) ===
tier: standard
intent: create
max-files: 6
---

# Skill: Add a website page

## Goal

A new route in `apps/website` that builds with `pnpm build`, is reachable
from the sidebar, carries correct search, social and agent metadata, is
covered by its per-route CSP, ships no client JavaScript unless it has an
interactive example, and describes only what exists (planned work labeled
as planned). texuli.com deploys from `main` to Cloudflare Pages, so a merged
page is public: never deploy by hand.

## When to use

- A guide, a reading page, an area page or a project page for texuli.com.

Not for: a component page (generated from its catalog manifest by
`src/pages/component-pages/[id].astro`) or a primitive page (generated from
`PRIMITIVES` in `src/components/primitives-page/primitives.ts`). Add the
manifest entry or the `PRIMITIVES` row instead.

## Inputs

- The route (for example `/guides/forms/`), its nav group, audience and
  content.

## Read first

- `apps/website/README.md` and the area's design note in
  `apps/website/docs/` (`site-*.md`).
- The cross-cutting notes: `site-seo.md` (head metadata, JSON-LD, sitemap,
  social images), `site-subsite.md` (nav groups, breadcrumbs, per-route
  metadata), `site-aeo.md` (Markdown twins, `llms.txt`, middleware),
  `site-csp.md` (hash policies), `site-analytics.md` (Umami, default-off).
- A model page: `src/pages/guides/rtl-i18n/index.astro` (a guide through
  `GuidesShell`), `src/pages/changelog/index.astro` (a plain `BaseLayout`
  page) or `src/pages/web-and-native/index.astro` (a reading page with
  JSON-LD).

## Steps

1. **Create the page** at `apps/website/src/pages/<route>/index.astro`.
   File-based routing maps the folder to `/<route>/`; keep the trailing
   slash in every link.
2. **Wrap it in `BaseLayout`** (`src/layouts/BaseLayout.astro`), or in
   `GuidesShell` for a guide. Pass a unique, factual `title` and
   `description`: `SeoHead` turns them into the canonical link, Open Graph
   and Twitter tags, and the SEO integration renders the page's 1200 × 630
   social image and its sitemap entry from them. `noindex` keeps a page out
   of the sitemap and drops the canonical (only the 404 uses it today).
3. **Structured data** (optional): pass `jsonLd` built in code from a
   helper in `src/lib/schema.ts` (for example `techArticleJsonLd`). Never
   build JSON-LD from page data or agent output. The BreadcrumbList is
   automatic (step 4).
4. **Register it in the nav source**: add the link to its group in
   `NAV_GROUPS` (`src/components/foundation/site.ts`); guides go in
   `GUIDES_SECTIONS` (`src/components/guides/nav.ts`). The sidebar, the
   breadcrumb trail (JSON-LD and the visible `nav[aria-label="Breadcrumb"]`),
   the pager and the footer doors all derive from it; there is no second
   hierarchy to edit.
5. **Docs shell and twin:** a reading page outside `/guides/` joins
   `DOC_SHELL_ROUTES` in `src/components/foundation/nav-data.ts`
   (`isDocsPath`). Docs pages get "Copy page", the table of contents, the
   pager and a Markdown twin (`<route>.md`, written at build time with
   absolute links) plus `Vary: Accept` in `_headers`. A page outside the docs
   shell needs an explicit decision there.
6. **Agent index:** if the page adds a site area or a new top-level link,
   give its section one factual line in `src/components/seo/llms-site.ts`,
   run `pnpm exec tsx scripts/generate-site-llms.ts` and commit the new
   `apps/website/public/llms.txt` (the AEO spec fails on drift). Add a
   `SITE_PAGES` entry in `src/components/search/index-data.ts` when the page
   should be searchable (the index is curated, not crawled).
7. **Styles:** the site tokens (`--tx-*` from the compiled site theme, plus
   the layer order in `src/styles/site-layers.css`); logical properties
   (`max-inline-size`, `margin-inline`, `padding-block`); no hard-coded
   colors when a token exists; light, dark and forced colors must all work.
8. **Accessibility:** one `h1`, ordered headings, descriptive link text,
   `aria-hidden="true"` on decorative graphics, visible focus, labelled
   controls.
9. **Interactivity (only if needed):** a Svelte 5 island in
   `src/components/<area>/` written with runes, mounted with
   `client:visible` (or `client:load` when it must run at once). Note in the
   handoff that the page now ships JavaScript and check it against its page
   budget in `src/components/perf/budgets.ts` (the default is 64 KB gzip of
   JavaScript and 96 KB page weight; overrides need the owner).
10. **CSP:** the build-time integration (`src/components/security/csp.ts`)
    hashes every inline script, style element and style attribute per
    route into `dist/_headers` and `dist/csp-manifest.json`, so write
    nothing that needs `unsafe-inline` or `unsafe-eval`. `connect-src` and
    `frame-src` are same-origin, and `img-src`/`media-src` add only `data:`,
    `blob:` and the documented fictional example origins; a page that needs
    another origin is a security decision for the owner, not a local edit. Trusted Types are required, so no DOM HTML
    sink can run anyway.
11. **Analytics:** Umami is off unless the owner sets
    `PUBLIC_UMAMI_WEBSITE_ID`; `BaseLayout` mounts the loader, so a page
    needs nothing. A new client event goes in `EVENTS` and `EventPayloads`
    (`src/lib/analytics.ts`), is sent through `track` (`src/lib/track.ts`)
    and extends `apps/website/tests/umami-wiring.test.ts`; payloads carry
    categories or counts, never free text or identifiers of people.
12. **Content safety:** no `set:html` or `{@html}`; links built from data go
    through `safeHref` from `@texuli/core/url-policy`; fictional data only
    (`example.com`).
13. **Honesty:** the packages are on npm as `0.6.0` (pre-1.0),
    not a stable release; the agent service and analytics are not
    provisioned in production. Copy states what ships today
    (`apps/website/tests/copy-honesty.test.ts` bans claims the repository
    contradicts, such as size or native parity claims).

## Validation

```bash
npx biome check apps/website
pnpm --filter @texuli/website typecheck          # astro check, 0 errors
pnpm vitest run apps/website                       # site unit tests
pnpm build                                         # the build log lists the new route
pnpm --filter @texuli/website check:csp            # every inline hash covered (after build)
TEXULI_E2E_PORT=<port> pnpm exec playwright test tests/e2e/site-seo.spec.ts tests/e2e/site-ia.spec.ts
TEXULI_E2E_PORT=<port> pnpm exec playwright test tests/e2e/site-<area>.spec.ts
```

Also run `tests/e2e/site-perf.spec.ts` when the page ships an island, and
`tests/e2e/csp.spec.ts` when it hydrates one. Offline audits of the built
site: `node scripts/audit-seo.mjs --dist apps/website/dist` and
`node scripts/audit-aeo.mjs --dist apps/website/dist` (critical findings
exit non-zero).

Optionally `pnpm preview` and open the route locally. `astro dev` and
`astro preview` apply no CSP and render no social images, so they prove
neither. From a non-interactive shell the server keeps running in the
background; stop it with `pnpm --filter @texuli/website exec astro preview stop`
(or `astro dev stop`).

## Notes

- Every browser command needs its own `TEXULI_E2E_PORT` when other agents
  run Playwright in the same checkout (4870 is the default).
- `<lastmod>` in the sitemap comes from the route source's last git commit;
  a page with no commit yet falls back to HEAD's date until it is committed.
- Measure any new client JavaScript as in `docs/PERFORMANCE.md`.
