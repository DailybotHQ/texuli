# Design tokens pages (texuli.com)

**App:** `apps/website`
**Paths:** `/tokens/` and `/tokens/components/` (Themes group)
**Data:** `src/components/tokens-page/tokens.ts`, over
`@texuli/tokens/system`, `@texuli/tokens/components`,
`@texuli/tokens/contract` (hooks) and `texuli/defaults`
**Tests:** `apps/website/tests/site-mcp-tokens.test.ts`,
`tests/e2e/site-tokens.spec.ts`

## Goal

The token contract v2 reference (ADR-020, PLAN_011 T-site-090), generated
from the registries the components read, so it cannot drift:

- `/tokens/`: the scope model (`[data-tx-scope]`, one fallback level,
  component tokens undeclared until a theme or design system sets them), how
  design systems and agents drive tokens (component and system tokens on a
  scope, hooks, `setDesignDefaults`), the hooks table, the defaults
  vocabulary, and every system family with its tokens and defaults.
- `/tokens/components/`: every component token, grouped by package, with
  the fallback its read carries, an index of anchors and a link to the
  component page where the site has one.

The design-system document that sets all of this from one JSON file is
planned (ADR-021) and is described as planned.

## Constraints

Static: no island. The reference is split in two documents so each stays
inside the default HTML budget (`/tokens/` 21.3 KB, `/tokens/components/`
23.2 KB gzip). Styles are page-wide under `.tx-tokens-ref`, so Astro writes
no scope attribute on each of the ~1,500 table cells; the component tables
show the key (the token is `--tx-<component>-<key>`, stated per component).
Page weight overrides in `src/components/perf/budgets.ts`: 100.5 KB
(limit 105) and 102.8 KB (limit 107), measured 2026-10-30.
