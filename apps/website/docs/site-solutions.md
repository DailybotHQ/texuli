# texuli.com Solutions system

**App:** `apps/website`
**Pages:** `/solutions/` (catalog), `/solutions/<slug>/` (one landing per Solution),
`/guides/solutions/<slug>/` (technical docs), `/built-with/` and `/built-with/<product>/`
(products built with Texuli), and `/solutions/index.json` (the registry as JSON)
**Decisions:** [ADR-027 to ADR-031](../../../docs/DECISIONS.md#adr-027-solutions-capabilities-components-and-products)
**Tasks:** PLAN_015 (status: in progress; each part below is marked as it ships)

## Purpose

A Solution is an embeddable open-source system that completes a user task end to end
(ADR-027). Each one gets a landing at the visual level of the home page: an editorial
hero with 3D texel art, one real demo island, signature stories, how it works, a verified
quickstart, recipes, a section for agents, platforms, and links to its docs. Products keep
their own brand and domain and appear under Built with Texuli.

Promoted in this wave: Slides, Documents, Workflows, Canvas and Sheets. Slides was the
pilot; the other four copy its structure.

## Status

| Part | Where | Status | Commit (first) |
| --- | --- | --- | --- |
| Registry (ADR-029) | `src/data/solutions/` (`schema.ts`, `entries/`, `index.ts`, `validate.ts`) | shipped | `fe9f5234` |
| Layout | `src/components/solutions/shared/SolutionLayout.astro`, `subnav/` | shipped | `1585bead` |
| Shared blocks | `src/components/solutions/shared/{hero,demo-frame,story,architecture,quickstart,platforms,resources}/` | shipped | `30844b34`, `2f4544fc`, `3253cd01`, `fa1ec9bc`, `fbafe3b5`, `a30b91ad`, `46c9bcf3` |
| Catalog `/solutions/` and `/solutions/index.json` | `src/pages/solutions/index.astro`, `index.json.ts`, `src/components/solutions/catalog/` | shipped | `641f3591` |
| Landings | `src/pages/solutions/<slug>/` | shipped for all five: Slides `1db2a2bf`, Documents `5d62cd12`, Workflows `7502692f`, Canvas `d5b69ed8`, Sheets `6bba4a9c` | as listed |
| Demo islands (ADR-030) | `src/components/solutions/<slug>/demo/` | shipped for all five: one island and an SSR preview each | with each landing |
| Docs | `src/pages/guides/solutions/<slug>/`, content in `src/content/solution-docs/<slug>/`, `src/components/solutions/docs-layout/` | shipped for all five | `8ae0c731` (shared page) |
| Agent surfaces | `src/lib/twins/solutions.ts` (index JSON, llms.txt sections, twin notes), `apps/website/scripts/solutions-surfaces.ts` | shipped | `3fe23da3` |
| Built with Texuli | `src/pages/built-with/`, `src/components/built-with/`, `src/data/products/` | shipped: `/built-with/` and `/built-with/protoyard/` | `25531456`, `f20d53e3`, `247041ad` |
| Art | `solution-<slug>-hero` slots in `src/data/illustrations.json` | slots registered; the WebP files are not in the repository yet, so each hero paints the texel mosaic | — |
| Redirects (ADR-028) | `apps/website/public/_redirects`, `functions/_middleware.ts` | mechanism shipped (`5c4e8ac2`); the five `*-page` moves stay commented until the migration wave enables them | `5c4e8ac2` |
| End-to-end specs | `tests/e2e/site-solution-<slug>.spec.ts` | Slides, Documents, Canvas and Sheets; Workflows planned | — |

## Rules

- Facts come from the registry and repository data, never typed copy. Copy cites
  package READMEs or the maturity audits.
- One demo island per landing, hydrated when visible, inside the budget of the page it
  replaces (ADR-030). The SSR preview shows the same fixture.
- Status words: available · in development · experimental · planned. No landing promises
  a hosted or cloud version of a Solution. Native statuses never exceed
  `native/docs/parity.json`; `validate.ts` enforces it.
- Never link the `*-page` route a landing replaces (it redirects to the landing once the
  move is enabled), and never link a route without a page (`siteRouteExists` in
  `src/components/foundation/nav-data.ts`).
- Modules that pages import never read the file system or use `import.meta.dirname`:
  both break once the site is bundled. Use the registry, or `import.meta.glob` with
  `?raw`.
- No plan ids or third-party brand names in site copy.
- Art follows [ILLUSTRATIONS.md](ILLUSTRATIONS.md); a missing file paints the texel mosaic.

## The blocks

`SolutionLayout` (on `BaseLayout` in landing mode) draws the breadcrumbs, the sticky
subnav and the band rhythm, runs `checkLandingContent` at build time, and composes the
blocks through named slots in the order of `src/components/solutions/shared/types.ts`:

| Slot | Block | Props | What it renders |
| --- | --- | --- | --- |
| `hero` | `hero/SolutionHero.astro` | `SolutionHeroProps` | The h1, lede, status from the entry, one or two calls to action (primary to `#demo`), and the art slot |
| `demo` | `demo-frame/SolutionDemoFrame.astro` | `SolutionDemoFrameProps` | The frame around the one island: the SSR preview, "try this" lines, reset, the error fallback |
| `stories` | `story/SolutionStories.astro` | `SolutionStoriesProps` | Alternating art and copy bands, capability chips from the entry, an optional status badge |
| `how` | `architecture/SolutionHow.astro` | `SolutionHowProps` | Numbered steps naming their package, and the "Built from Texuli" layer diagram from `entry.packages` |
| `quickstart` | `quickstart/Quickstart.astro` | `SolutionQuickstartProps` | The install line and samples; the samples are compiled or run by a test |
| `recipes` (optional) | `resources/SolutionRecipes.astro` | `SolutionRecipesProps` | Links to existing pages or package pages |
| `agents` | `platforms/SolutionAgents.astro` | `SolutionAgentsProps` | MCP, catalog and skill surfaces that exist, each with a status badge |
| `platforms` | `platforms/SolutionPlatforms.astro` | `SolutionPlatformsProps` | Web, Compose Desktop, Android and iOS rows from the entry, with evidence links |
| `next` | `resources/SolutionRelated.astro` and `resources/SolutionNextSteps.astro` | `SolutionNextStepsProps` | Related Solutions from the registry, then next steps that must include the docs route |

`platforms/StatusBadge.astro` is the shared status badge: it always prints the word, never
color alone.

## Add a Solution

The Slides landing (`src/pages/solutions/slides/`) is the reference; copy its structure.

1. **Promote it on evidence.** A Solution passes the ADR-027 rule (a public model and
   API, a complete user task demonstrable today, composed parts, an adoption path and
   docs). Add its slug to `SOLUTION_SLUGS` in `src/data/solutions/schema.ts`.
2. **Registry entry.** Write `src/data/solutions/entries/<slug>.ts` and add it to
   `SOLUTIONS` in `index.ts`. Packages and subpaths must exist in `packages/*/package.json`;
   native platforms stay `planned` unless `native/docs/parity.json` supports more and the
   evidence paths exist. `pnpm vitest run apps/website/tests/solutions/registry-validator.test.ts`
   runs `validateSolutionRegistry`.
3. **Sections.** Under `src/components/solutions/<slug>/`, one folder per section
   (`hero/`, `stories/`, `how/`, `quickstart/`, `extras/`), each with a content `.ts`, a
   thin `.astro` over the shared block, and a test in `apps/website/tests/solutions/`.
   Agent surfaces must exist in `packages/tools/src/ops`, the catalog or `skills/texuli`.
4. **Demo island and preview.** In `src/components/solutions/<slug>/demo/`: a framework-free
   `model.ts` with fixtures, one Svelte island (`client:visible`) on the real package
   APIs, and an SSR preview of the same fixture. Reset, keyboard, reduced motion, no
   network, no HTML sinks. Accessibility: labelled groups have `role="group"`, scrollable
   code is `tabindex="0"`, and accessible names contain the visible label.
5. **Docs.** Markdown in `src/content/solution-docs/<slug>/` (loaded with `?raw`, parsed by
   the shared `parse.ts`) and a thin route page in `src/pages/guides/solutions/<slug>/`
   using `SolutionDocsPage`.
6. **Art.** Register `solution-<slug>-hero` (and any extra slots) in
   `src/data/illustrations.json`. Until the WebP file lands, the slot paints the texel
   mosaic.
7. **Page.** `src/pages/solutions/<slug>/index.astro` plus `_content.ts`, copied from
   Slides: every section in its `SolutionLayout` slot, with `checkLandingContent` passing.
8. **Tests.** `apps/website/tests/solutions/<slug>-page.test.ts` mirrors
   `slides-page.test.ts` (registry routes with `requireRoutes`, a single island, the llms
   section and the twin note). `tests/e2e/site-solution-<slug>.spec.ts` mirrors the Slides
   spec and joins `tests/e2e/shards.json`.
9. **Budgets.** The landing inherits the measured caps of the `*-page` route it replaces,
   as an override in `src/components/perf/budgets.ts` (measured value + 4%, with a
   reason). Re-measure on the built route.
10. **Agent surfaces.** The index JSON, the llms.txt section and the twin note follow the
    registry once the page exists. Regenerate the committed surfaces with
    `pnpm exec tsx scripts/generate-surfaces.ts`, then confirm `pnpm check:surfaces`
    passes.
11. **Before merging.** Run `pnpm --filter @texuli/website typecheck`,
    `pnpm vitest run apps/website/tests` and `pnpm build`, then check the built route:
    `pnpm exec tsx apps/website/scripts/solutions-surfaces.ts --check-dist apps/website/dist`,
    `pnpm --filter @texuli/website check:csp`, and the landing's e2e spec with
    `TEXULI_E2E_PORT=<port>`.
12. **Redirect.** Enabling the `*-page` move to the new landing is a separate migration
    step (ADR-028), done only after the landing ships.
