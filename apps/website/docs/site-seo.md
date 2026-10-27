# texuli.com: SEO, social images and sitemap

**App:** `apps/website` · **Code:** `src/components/seo/` · **Task:**
T-site-seo

Search and social metadata on every page, a generated Open Graph image per
page (built at compile time), `sitemap.xml`, `robots.txt` and a 404 page.
Everything is a static file in `dist/`. Nothing runs at request time, and
no page asks another origin for anything.

```bash
pnpm build      # astro check && astro build; the SEO integration runs at the end
```

The build log reports the output in the form
`[texuli-seo] sitemap.xml (<n> pages with lastmod), robots.txt and <n> social images written.`
(the page count grows with the site; the T-29 audit run read 550 built
pages, indexed and noindex together).

## Head metadata (`SeoHead.astro`)

`BaseLayout` renders `<SeoHead>` for every page (it replaced the layout's
old canonical and two Open Graph lines):

| Tag | Value |
| --- | --- |
| `link rel="canonical"`, `og:url` | `https://texuli.com/<page>/`, honoring `TEXULI_SITE_BASE` |
| `og:type`, `og:site_name`, `og:locale` | `website`, `Texuli`, from the page `lang` (`en_US`) |
| `og:title`, `og:description` | the document title and description |
| `og:image` (+ `:type`, `:width`, `:height`, `:alt`) | `https://texuli.com/og/<page>.png`, 1200 × 630 PNG |
| `twitter:card` (+ title, description, image, alt) | `summary_large_image` |

**`noindex`.** `BaseLayout`'s new `noindex` prop (the 404 uses it) emits
`<meta name="robots" content="noindex">` and drops the canonical link and
the image tags. The integration also leaves such pages out of the sitemap.

## Social images, sitemap and robots (`integration.ts`)

`seoIntegration()` is registered in `astro.config.mjs` and runs on
`astro:build:done`, after every page, dynamic routes included, is built.
For each page:

1. **Read** the built `<title>` and description (`readPageMeta`). Pages
   with `noindex`, and the 404, are skipped.
2. **Render** the social image as SVG (`ogImageSvg`): brand mark, page
   title (wrapped to 3 lines), description (3 lines), the page path. Every
   string is XML-escaped; the colors pass AA (white and slate on
   near-black).
3. **Rasterize** to PNG with **Astro's own image service**
   (`astro/assets/services/sharp`). `sharp` is already Astro's dependency,
   so the site adds none. `dangerouslyProcessSVG` is enabled only for this
   SVG, which the build generates from escaped text and never takes from
   input. A 256-color palette brings each image from about 69 KB to about
   26 KB (4.4 MB for 163 pages).
4. **Write** `dist/og/<page>.png` (`/` → `og/index.png`,
   `/component-pages/button/` → `og/component-pages/button.png`).

Then it writes:
- `dist/sitemap.xml`: every indexed page, absolute, sorted, deduplicated,
  each with a `<lastmod>` from git (PLAN_006 T-20, below);
- `dist/robots.txt`: allow everything, the `Sitemap:` line and one
  `Allow: /` group per AI crawler (T-20, below).

The pure helpers live in `seo.ts`: path normalization, file names,
absolute URLs, XML escaping, the sitemap and robots builders, meta
reading, text wrapping and the SVG template.

## 404 (`NotFound.astro`, `src/pages/404.astro`)

"Page not found", links to Home, Components, Guides and Search, and
`noindex`. The requested path is **not** echoed into the page, so nothing
is reflected. Static hosts serve `404.html` for unknown paths.

## Verified

`bash -c 'pnpm build && pnpm exec playwright test tests/e2e/site-seo.spec.ts'`
(with `TEXULI_E2E_PORT` set to the lane port): **42 passed** on chromium,
webkit and Pixel 7. The spec serves `dist/` like a static host, returning
`404.html` with status 404 for unknown paths.

- **Helpers** (run inside the spec):
  - path normalization with a base path; image file names; absolute URLs;
  - XML escaping, control characters included;
  - the sitemap (sorted, deduplicated, escaped) and robots;
  - meta reading with entities and `noindex`;
  - wrapping with an ellipsis;
  - hostile titles and descriptions produce no `<script>` or `<image>` in
    the SVG.
- **Output:**
  - robots content;
  - the sitemap equals the built pages minus the 404, exactly and once
    each;
  - every listed page has a real 1200 × 630 PNG (signature and IHDR
    checked);
  - head metadata on `/`, `/guides/theming/` and
    `/component-pages/button/`: canonical, `og:*`, the twitter card, no
    robots meta, the image served as `image/png`, no foreign requests.
- **404:**
  - an unknown path returns status 404 with the page;
  - `noindex`, no canonical, no image tags; the path is not echoed;
  - Home links to `/`; the skip link moves focus to `main`;
  - axe is clean on the 404 and home pages in light and dark (scheme
    emulated, `data-tx-mode` checked).

## Limits

- **Social images exist only in the build:** under `pnpm dev` the
  `og:image` URLs 404.
- **Fonts:** image text uses the build machine's system font through
  librsvg (Inter or Helvetica, falling back to Arial), so glyphs differ
  slightly between macOS and Linux builds.
- **`<lastmod>` comes from git, not the build date** (T-20): a build
  outside a git checkout fails instead of shipping invented dates.
- **The 404 relies on the host:** it must serve `404.html` for unknown
  paths, as Cloudflare Pages, Netlify and GitHub Pages do.

## PLAN_006 additions (T-18..T-21, T-29)

| Addition | Where | Pinned by |
| --- | --- | --- |
| **JSON-LD.** `JsonLd.astro` renders code-authored data only (never page data or agent output). `/` carries Organization, WebSite with a SearchAction and SoftwareApplication (`libraryJsonLd` in `src/lib/schema.ts`; the version is read from the installed `texuli` manifest, the description says "in development", no `offers`). `/web-and-native/` carries a TechArticle. The CSP integration hashes the inline blocks automatically | `src/components/seo/JsonLd.astro`, `src/lib/schema.ts`, `BaseLayout`'s `jsonLd` prop | `tests/e2e/site-seo.spec.ts` |
| **BreadcrumbList** on nested pages from the sidebar nav, plus the visible trail on docs pages ([site-subsite.md](site-subsite.md)) | `src/components/seo/breadcrumbs.ts` | `tests/e2e/site-seo.spec.ts` |
| **Per-page `<lastmod>`** from `git log -1 --format=%cs` of the route's source (component and primitive pages also follow their manifests and sources) | `src/components/seo/integration.ts` | `tests/e2e/site-seo.spec.ts` |
| **AI-crawler robots policy.** 16 named crawlers (`AI_CRAWLERS`), each allowed; no `Disallow`, no static `Content-Signal` (a per-agent header a static file cannot serve). The edge variant for strict parsers is in [site-aeo.md](site-aeo.md) | `src/components/seo/seo.ts` | `tests/e2e/site-seo.spec.ts`, `apps/website/tests/edge-middleware.test.ts` |
| **Area badges on social images.** `ogAreaFor(path)` maps a route prefix to a section label and accent (Guides, Components, Primitives, Themes, Agents, Project, Native, Architecture); unmapped routes get the brand card. Labels only, no metrics | `src/components/seo/seo.ts` | `tests/e2e/site-seo.spec.ts` |
| **Verification metas.** `google-site-verification` and `msvalidate.01` render only when `PUBLIC_GOOGLE_SITE_VERIFICATION` or `PUBLIC_BING_SITE_VERIFICATION` is set; absent by default | `src/lib/constances.ts`, `SeoHead.astro` | `apps/website/tests/analytics-client.test.ts`, `tests/e2e/site-seo.spec.ts` |
| **Offline audit.** `node scripts/audit-seo.mjs --dist apps/website/dist` checks titles, descriptions, canonicals, the OG and Twitter sets, JSON-LD validity, the PNG art, sitemap equality and the robots shape; critical findings exit non-zero. Its T-29 run: 550 pages, 0 critical, 33 warning (length bands and one duplicate-description pair), 4 planned | `scripts/audit-seo.mjs` | `scripts/tests/audit-seo.test.ts` |

**Planned, not shipped:** `twitter:site` and `twitter:creator` (no handle
exists, so none is rendered), an image sitemap extension (graded optional
by the SEO audit), and the other open audit rows the script reports as
`planned`.
