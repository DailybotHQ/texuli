# texuli.com architecture page (web and native)

**App:** `apps/website`
**Page:** `/web-and-native/`
**Route source:** `src/pages/web-and-native/index.astro`
**Shell wiring:** `DOC_SHELL_ROUTES` in `src/components/foundation/nav-data.ts`;
the `platform` nav group in `src/components/foundation/site.ts`
**Sections:** `src/components/sections/architecture/` (`LayerGraph`, `TexelLadder`,
`PortabilityDeepDive`, `ParityTable`) plus `WebCorrelation` from `sections/web/`
**Task:** PLAN_006 T-31 (scaffold), T-32 (shell), T-49..T-52 (sections)

## What this page is

The correlation story: why both technologies, the one-contract mechanism
(one manifest → TS + Kotlin projections), interface portability, and the
honest "what exists today". A docs-shell **reading page** — TOC, pager,
copy-page — not a landing. It complements and links
`/guides/why-svelte-kotlin/` (the technical deep-dive, which stays at its
URL — T-12: no existing route moves) and links `/native/`.

## Metadata contract (T-17)

- Title: `Web and native, one contract — Texuli's architecture`
- Description: the spec seam, portability, honest status
- Canonical self; OG set from SeoHead; OG art: the Architecture badge from `ogAreaFor` (T-21)
- JSON-LD: BreadcrumbList from the docs chrome and the TechArticle graph
  (`techArticleJsonLd` in `src/lib/schema.ts`, T-52)

## Sections (as shipped, T-49..T-52)

1. `#why-both` — why Svelte for the web, why Kotlin for native, then the
   layer diagrams (`#how-layered`: `LayerGraph` from `layers-data.ts`,
   `TexelLadder`)
2. `#one-contract` — the spec manifest and its TypeScript and Kotlin
   projections under `packages/spec/generated/`, walked by the shared
   `WebCorrelation` demo (the same component as on the landing)
3. `#portability` — `PortabilityDeepDive` (`portability-content.ts`): what
   moving an interface between runtimes takes
4. `#what-exists-today` — the release truth (25 packages on npm as
   `0.8.0` (`@texuli/slides` as `0.8.1`, a layout fix), a pre-1.0 release, nothing on Maven Central, the Compose
   renderer consumed from source) and `ParityTable` (`parity-data.ts`),
   one evidence cell per row

The page shares the component + content module pattern of the landing
system ([site-landing.md](site-landing.md)); the route and shell decision
is in [site-subsite.md](site-subsite.md). Unit tests:
`apps/website/tests/section-contracts.test.ts`.

## Cross-link invariant (asserted, not hoped)

- `/` links both new routes (landing header Platform nav)
- `/native/` links `/web-and-native/`
- `/web-and-native/` links `/native/` and `/guides/why-svelte-kotlin/`
- the `platform` llms.txt section lists both routes

## Gates

- `pnpm build` (website)
- Content: `apps/website/tests/section-contracts.test.ts` (every cited claim
  and excerpt is anchored in its file, the layer data matches the documented
  and enforced graph, section links are real routes, honesty);
  `apps/website/tests/site-build-guards.test.ts` (the TechArticle graph);
  `apps/website/tests/docs-reading.test.ts` (one "On this page", no demo
  navigation, reading text whole). The page has no spec of its own since the
  2026-10-27 trim.
- Built output: axe and polish in light and dark in the page sweep
  (`tests/e2e/a11y-site-<n>.spec.ts`); its links in the built-site link audit and
  its head in the SEO audit (`tests/e2e/site-seo.spec.ts`); docs-shell
  membership in `tests/e2e/site-ia.spec.ts`; 360 and 768 px in
  `tests/e2e/site-responsive.spec.ts`; a full Tab walk is not run on it
