# texuli.com native landing

**App:** `apps/website`
**Page:** `/native/`
**Route source:** `src/pages/native/index.astro`
**Sections (G7):** `src/components/native/` (T-45..T-48 create them)
**Task:** PLAN_006 T-31 (scaffold), T-45..T-48 (sections)

## What this page is

The native-focused landing: the Kotlin Multiplatform story, the honest
status (Compose renderer in development, conformance-tested, not on
Maven), the spec-contract mechanism and the roadmap granularity from
`native/README.md`. A landing about the native runtime — **not** a fenced
sub-site: it shares the shell system, theme, CSP and analytics of the one
site (subsite-ia-routes.md, "Sub-site boundaries").

## Shell

`BaseLayout` with `landing` — the landing header (logo, Docs, the
Platform doors, search, switch, Get started), full-width main, no
sidebar. Header decisions are owned by `site-foundation`/
`site-sidebar-nav`; the IA decisions live in
`.dwp/plans/PLAN_006_website_marketing_seo_analytics/analysis_results/subsite-ia-nav.md`.

## Sections (top to bottom, G7 fills them)

1. Hero — the same catalog, rendered by Compose (T-45)
2. Runtime story — how the KMP renderer consumes the contract (T-46)
3. Spec-contract mechanism — one manifest, TS + Kotlin projections (T-47)
4. Honest status + roadmap integration (T-48)

The scaffold carries the hero's factual status copy only. No lorem, no
fake screenshots, no dates presented as promises, no "coming soon".

## Metadata contract (T-17)

- Title: `Texuli native — the same catalog, rendered by Compose`
- Description: what the contract drives, in-development status named
- Canonical self; OG set from SeoHead; OG art: native card (T-21, planned)
- JSON-LD: **Organization only** — nothing installable exists, so a
  SoftwareApplication node would be dishonest

## Gates

- `pnpm build` (website)
- `tests/e2e/site-native.spec.ts` (skeleton: shipped behavior real, G7
  sections as `test.fixme` placeholders)
- IA reachability: `tests/e2e/site-ia.spec.ts` (landing-shell route #2;
  one interaction from the home header)
- a11y/site-perf route budget: added with T-48's integration
