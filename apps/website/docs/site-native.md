# texuli.com native landing

**App:** `apps/website`
**Page:** `/native/`
**Route source:** `src/pages/native/index.astro`
**Sections:** `src/components/sections/native/` (built by T-45..T-47, assembled by T-48)
**Task:** PLAN_006 T-31 (scaffold), T-45..T-48 (sections + assembly)

## What this page is

The native-focused landing: the Kotlin Multiplatform story, the honest
status (Compose renderer in development, conformance-tested, not on
Maven), the spec-contract seam and the roadmap granularity from
`native/README.md`. A landing about the native runtime — **not** a fenced
sub-site: it shares the shell system, theme, CSP and analytics of the one
site (subsite-ia-routes.md, "Sub-site boundaries").

## Shell

`BaseLayout` with `landing` — the landing header (logo, Docs, the
Platform doors, search, switch, Get started), full-width main, no
sidebar. Header decisions are owned by `site-foundation`/
`site-sidebar-nav`; the IA decisions live in
`.dwp/plans/PLAN_006_website_marketing_seo_analytics/analysis_results/subsite-ia-nav.md`.

## Sections (top to bottom, as shipped)

Each section is a static Astro component fed by a shared, unit-tested
content module; the page (`pages/native/index.astro`) mounts them in
blueprint order inside the landing wrapper. The hero's `h1` is the
page's only `h1`.

1. Hero + status — `NativeHeroStatus.astro` + `native-hero-content.ts`
   (T-45): the one-contract claim, the honest eyebrow, two calls to
   action, and the "What exists today" ledger (shipped / in development /
   planned, with the planned marker on planned rows).
2. Why Kotlin Multiplatform — `WhyKmp.astro` + `why-kmp-content.ts`
   (T-46): the runtime story, every claim cited to the guide or
   `native/README.md`, with verbatim Kotlin excerpts as named,
   keyboard-scrollable code regions.
3. Evidence + roadmap — `NativeEvidenceRoadmap.astro` +
   `native-evidence-data.ts` (T-47): the real native modules at their
   repo paths, the shipped/planned split under the visible "Planned"
   heading, and on-site links only.

No lorem, no fake screenshots, no dates presented as promises, no
"coming soon".

## Metadata contract (T-17)

- Title: `Texuli native — the same catalog, rendered by Compose`
- Description: what the contract drives, in-development status named
- Canonical self; OG set from SeoHead; OG art: the Native badge from `ogAreaFor` (T-21)
- JSON-LD: **Organization only** — nothing installable exists, so a
  SoftwareApplication node would be dishonest

## Gates

- `pnpm build` (website)
- `tests/e2e/site-native.spec.ts`: real assertions since T-48 —
  metadata, hero + status honesty, the runtime story, the spec seam and
  roadmap, section order, the heading ladder and IA reachability, all
  against the built HTML
- IA reachability: `tests/e2e/site-ia.spec.ts` (landing-shell route #2;
  one interaction from the home header)
- a11y: covered by the sitewide sweep (`tests/e2e/a11y-site.spec.ts`,
  every built page)
- Per-route a11y/site-perf budget registration for `/native/`:
  **planned** — the budgets file is owner-held, so the entry is proposed
  at the wave close (T-93/T-98), never edited by a lane
