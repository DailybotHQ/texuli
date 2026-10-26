# texuli.com architecture page (web and native)

**App:** `apps/website`
**Page:** `/web-and-native/`
**Route source:** `src/pages/web-and-native/index.astro`
**Shell wiring:** `DOC_SHELL_ROUTES` in `src/components/foundation/nav-data.ts`;
the `platform` nav group in `src/components/foundation/site.ts`
**Sections (G8):** written into the page's four section slots (T-49..T-52)
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
- Canonical self; OG set from SeoHead; OG art: architecture card (T-21, planned)
- JSON-LD: BreadcrumbList from the docs chrome; the **TechArticle graph
  lands with T-52** (the page's integration task)

## Section slots (T-49..T-52 fill them)

1. `#why-both` — why Svelte for the web, why Kotlin for native (T-49)
2. `#one-contract` — the spec manifest and its two projections (T-50)
3. `#portability` — what moving an interface between runtimes takes (T-51)
4. `#what-exists-today` — shipped vs in development, honestly (T-52)

The scaffold ships "this section is being written" placeholders with the
cross-links live. No lorem, no fake copy.

## Cross-link invariant (asserted, not hoped)

- `/` links both new routes (landing header Platform nav)
- `/native/` links `/web-and-native/`
- `/web-and-native/` links `/native/` and `/guides/why-svelte-kotlin/`
- the `platform` llms.txt section lists both routes

## Gates

- `pnpm build` (website)
- `tests/e2e/site-architecture.spec.ts` (skeleton: shipped behavior real,
  G8 sections as `test.fixme` placeholders)
- IA reachability and docs-shell membership: `tests/e2e/site-ia.spec.ts`
  (DOC_SHELL_ROUTES; every nav target resolves)
