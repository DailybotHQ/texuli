# Golden fixture suite

The eight expressiveness screens from the PLAN_002 audit (01 to 08,
`.dwp/plans/PLAN_002_universal_ecosystem_roadmap/analysis_results/blueprint-fixtures/`,
a git-ignored plan folder), plus one agent document (09, below), promoted into the repository as a golden
regression gate. The JSON fixtures are verbatim copies of the audit's screens
— fictional data only — including their audit-day metadata (`result`,
`gaps`, `notes`, `northStar`, and the `expect` arrays inside `probes`), which
are kept as provenance and are **not** enforced by the runner.

## What is pinned

`golden-expectations.json` records, per fixture, the catalog's behavior on
2026-10-24 at dev `746ed7fc` (catalog build `catalog-e82af62c…json`, 131
entries, the default D5 developer view — no `{ developer: 'all' }` override):

- render codes, grammar issues, sink findings, tools guidance findings;
- input node count, rendered components and placeholders at the fixture's
  declared tier **and** at the opposite tier;
- the artifact frame chrome for the fixtures that declare a `frame`
  (02, 07, 08);
- every probe's effective tier, render codes and placeholder count.

`pnpm vitest run packages/catalog` enforces the catalog side through
[`packages/catalog/tests/golden-fixtures.test.ts`](../../../packages/catalog/tests/golden-fixtures.test.ts).
The runner below enforces the same file plus the tools-side guidance check
(`checkGuidance` from `@texuli/tools/golden`), which stays out of the catalog
package's dependency graph.

## Running

```bash
pnpm exec tsx tests/fixtures/golden/run-golden-fixtures.mts
```

Exit 0 prints `no drift`; exit 1 prints every `DRIFT …` finding. The catalog
gate test fails the same way inside `pnpm vitest run packages/catalog`.

## Findings recorded at pin time

The audit ran before the normative developer tier (decision D5,
[packages/catalog/docs/catalog-build.md](../../../packages/catalog/docs/catalog-build.md))
and before the renderer's block-family checks landed, so several audit-day
outcomes were renamed or closed by the time this suite was pinned:

- **Fixtures 01, 02, 05, 06, 07, 08** (untrusted) render fully at their tier:
  zero placeholders, no codes, no grammar issues, no sinks, no guidance.
- **Fixture 03** (settings form, declared `developer`) collapses to one
  `tier-denied` placeholder at both tiers: its tree is app chrome
  (`layout-settings`, `form`, `input`, `button`), which is not
  `agentEmittable` and therefore denied by the normative developer tier. The
  audit-day `developer` tier allowed it; D5 deliberately narrowed the tier.
- **Fixture 04** (checkout flow, declared `developer`) renders partially
  (6 components, 3 placeholders): `stepper`, `callout` and `form` are
  denied for the same reason.
- **Probe renames.** The audit's `family-mismatch` expectation (G05 probes in
  01, 04, 06) is now the implemented `block-family-mismatch` plus
  `schema-failure` and `node-dropped`. The G24 probe in 01 (hero image as a
  media block with a remote https URL) now renders clean — the gap closed.
  The `invalid-prop` expectations in probes G04, G20, G02/G17/G03/G01 (03),
  and G09/G18 (04) are now `tier-denied`: D5 denies a non-emittable id
  before its props are validated.
- **G03 probe (03).** `button` now declares a plain-text `label` prop, so the
  probe's props are valid. The pinned outcome stays `tier-denied`: `button`
  is app chrome, not `agentEmittable`, so the D5 developer tier still denies
  it. The probe renders clean only for a host that passes
  `{ developer: 'all' }`.
- **G04 and G07 probes (01, 04).** The catalog now takes a node-level
  `slot` (named slots) and `when` (a blocks `Condition`). The probes keep
  their audit-day shapes, `hero` and `footer` as slot props and `when` as a
  prop string, which stay refused, so their pinned outcomes do not change.
  The node-level forms are tested in
  [`packages/catalog/tests/render-slots-conditions.test.ts`](../../../packages/catalog/tests/render-slots-conditions.test.ts).

- **Fixture 09 (spec 0.7.0, PLAN_010).** `09-document-brief.json` is not an
  audit screen: it adds an agent document in the same format, a keyed
  `document` root whose `doc` holds a link, a list, a wrapped `blocks-data`
  stat, a `charts-sparkline` component embed and a callout. It renders clean
  at both tiers with its artifact frame; probe D01 (no `doc`) fails the
  required prop and D02 (an `html` prop beside the `doc`) is a forbidden
  prop. The suite runs the renderer, grammar and sink scan only; the
  document checks run in `validateDraft` with the host's `checkDocument`
  ([`packages/catalog/tests/validate-document.test.ts`](../../../packages/catalog/tests/validate-document.test.ts)).

When a finding is intended (a deliberate catalog, manifest or fixture
change), update `golden-expectations.json` in the same change — regenerate it
by recomputing through `suite.ts` — and refresh the `$comment`. Never edit
the expectations only to silence a finding.

## Planned

Not done yet: a root `package.json` script alias for the runner (the file is
owner-held) and CI wiring. Until then the commands above are the interface.
