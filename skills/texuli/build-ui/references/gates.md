# Build-ui gates (offline)

Run from the **monorepo root**. Lane Playwright always sets `TEXULI_E2E_PORT`
(lane J: **4910**). Do **not** use 4870 or 4890–4899 (lead-reserved).

## Skill pack

```bash
pnpm exec tsx scripts/check-skill.ts --write-sums
pnpm vitest run scripts/tests/skill.test.ts
./skills/texuli/setup.sh --verify
```

## Catalog and renderer

```bash
pnpm exec tsx packages/catalog/src/build/cli.ts --json
pnpm vitest run packages/catalog/tests/render-renderer.test.ts
pnpm vitest run packages/catalog/tests/render-limits.test.ts
pnpm vitest run packages/catalog/tests/render-grammar.test.ts
pnpm vitest run packages/catalog/tests/render-hostile.test.ts
pnpm vitest run packages/catalog/tests/render-richtext.test.ts
pnpm --filter @texuli/catalog typecheck
npx biome check packages/catalog/src packages/catalog/tests
```

## Styled UI you composed

```bash
pnpm vitest run packages/texuli/tests/<name>.test.ts
pnpm --filter texuli typecheck
npx biome check packages/texuli/src/components/<name> packages/texuli/tests/<name>.test.ts
# Report gzip only; do not edit texuli.budgets.json
pnpm size --filter 'texuli/<subpath>'
```

## Website page (if you touched apps/website)

```bash
pnpm --filter @texuli/website build
TEXULI_E2E_PORT=4910 pnpm exec playwright test tests/e2e/<spec>.spec.ts
```

## Examples + visuals (only when you register a new example id)

```bash
git merge --no-edit dev
TEXULI_E2E_PORT=4910 pnpm visual:update -g <example-id>
# Commit only your new PNGs under tests/visual/visual.spec.ts-snapshots/
```

## MCP catalog (local stdio)

```bash
pnpm vitest run packages/tools/tests/mcp.test.ts
```

Tool **`catalog`**: query component metadata offline. No network.

## Perf

Wall-clock assertions never run in the default suite. Use `tests/perf` or
`process.env.TEXULI_PERF === '1'`.
