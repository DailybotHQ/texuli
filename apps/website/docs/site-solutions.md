# texuli.com Solutions system

**App:** `apps/website`
**Pages:** `/solutions/` (catalog), `/solutions/<slug>/` (one landing per Solution),
`/guides/solutions/<slug>/` (technical docs), `/built-with/` and `/built-with/<product>/`
(products built with Texuli)
**Decisions:** [ADR-027 to ADR-031](../../../docs/DECISIONS.md#adr-027-solutions-capabilities-components-and-products)
**Tasks:** PLAN_015 (status: in progress; this page describes the design, and each section
is marked when it ships)

## Purpose

A Solution is an embeddable open-source system that completes a user task end to end
(ADR-027). Each one gets a landing at the visual level of the home page: an editorial
hero with 3D texel art, one real demo island, signature stories, how it works, a verified
quickstart, recipes, a section for agents, platforms, and links to its docs. Products keep
their own brand and domain and appear under Built with Texuli.

Promoted in this wave: Slides, Documents, Workflows, Canvas and Sheets.

## Status (planned until each task ships)

| Part | Where | Status |
| --- | --- | --- |
| Registry (ADR-029) | `src/data/solutions/` | planned |
| Shared blocks and `SolutionLayout` | `src/components/solutions/shared/` | planned |
| Catalog `/solutions/` | `src/pages/solutions/index.astro` | planned |
| Landings | `src/pages/solutions/<slug>/` | planned |
| Demo islands (ADR-030) | `src/components/solutions/<slug>/demo/` | demo models for Slides, Documents, Workflows and Canvas exist; islands planned |
| Docs | `src/pages/guides/solutions/<slug>/` | planned |
| Built with Texuli | `src/pages/built-with/`, `src/data/products/` | planned |
| Redirects (ADR-028) | `public/_redirects`, `functions/_middleware.ts` | planned |

## Rules

- Facts come from the registry and repository data, never typed copy.
- One demo island per landing, hydrated when visible, inside the budget of the page it
  replaces (ADR-030). The SSR preview shows the same fixture.
- Status words: available · in development · experimental · planned. No landing promises
  a hosted or cloud version of a Solution.
- Art follows [ILLUSTRATIONS.md](ILLUSTRATIONS.md); a missing file paints the texel mosaic.
