# Contribute — gate matrix

All commands are offline and scoped. Replace `<name>` and `<example-id>`.
Lane Playwright always sets `TEXULI_E2E_PORT` (lane I: **4880**). Do not use
4870 or 4890–4899 (lead-reserved).

| Stage | Unit | Typecheck | Lint | E2E / visual / size |
| --- | --- | --- | --- | --- |
| A texel | `pnpm vitest run packages/core/tests/<name>.test.ts` | `pnpm --filter @texuli/core typecheck` | `npx biome check packages/core/src/<area> packages/core/tests/<name>.test.ts` | — |
| B primitive | `pnpm vitest run packages/primitives/tests/<name>.test.ts` | `pnpm --filter @texuli/primitives typecheck` | `npx biome check packages/primitives/src/<name> …` | `TEXULI_E2E_PORT=4880 pnpm exec playwright test tests/behavior/scenarios/<name>.spec.ts` |
| C styled | `pnpm vitest run packages/texuli/tests/<name>.test.ts` | `pnpm --filter texuli typecheck` | `npx biome check packages/texuli/src/components/<name> …` | `pnpm size --filter texuli/<name>` (report only; no budget file edits) |
| D catalog | `pnpm vitest run packages/catalog/tests/manifests-<family>.test.ts` | `pnpm --filter @texuli/catalog typecheck` | biome on touched manifests | — |
| E examples | — | examples typecheck if present | biome on example folder | `TEXULI_E2E_PORT=4880 pnpm visual:update -g <example-id>` then visual test |
| F website | — | `pnpm --filter @texuli/website typecheck` | biome on page | site e2e when applicable |
| Skill pack | `pnpm vitest run scripts/tests/skill.test.ts` | — | — | `pnpm check:skill` · `./skills/texuli/setup.sh --verify` |

## Full monorepo gate

Only when the developer asks or when shared root config changed (owner path):

```bash
pnpm check
```

## Perf timings

Wall-clock assertions never run in the default suite. Put them under
`tests/perf` or guard with `process.env.TEXULI_PERF === '1'`.
