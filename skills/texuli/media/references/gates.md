# Media gates (offline)

Run from the monorepo root. Replace the test path with the area you touched.

```bash
pnpm vitest run packages/media/tests/<area>.test.ts
pnpm --filter @texuli/media typecheck
npx biome check packages/media/src/<area> packages/media/tests/<area>.test.ts
pnpm size --filter '@texuli/media/<subpath>'
```

Common areas: `image`, `gallery`, `video`, `captions`, `export`, `generator-slot`,
`composition-canvas`, `audio`.

Examples + visuals (lane port, never 4870 / 4896–4899):

```bash
git merge --no-edit dev
TEXULI_E2E_PORT=4920 pnpm visual:update -g <example-id>
TEXULI_E2E_PORT=4920 pnpm exec playwright test tests/visual/visual.spec.ts -g <example-id>
```

Skill pack integrity after editing `skills/texuli/**`:

```bash
pnpm exec tsx scripts/check-skill.ts --write-sums
pnpm vitest run scripts/tests/skill.test.ts
./skills/texuli/setup.sh --verify
```

Do **not** edit `texuli.budgets.json` when a subpath is over budget — report gzip
in the task outbox and let the lead set an exact entry.
