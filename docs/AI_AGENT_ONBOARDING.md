# AI agent onboarding — Texuli

A first-session checklist. It takes a few minutes and leaves you with a
verified baseline before you change anything.

## 1. Read the entry points

1. [`AGENTS.md`](../AGENTS.md): rules, quick commands, authority.
2. [`PRODUCT_SPEC.md`](PRODUCT_SPEC.md): what exists today versus what is
   planned. Most of the library is planned; do not describe it as built.
3. [`ARCHITECTURE.md`](ARCHITECTURE.md): the seven down-only layers.
4. The README of the module you will touch:
   [`packages/core`](../packages/core/README.md) or
   [`apps/website`](../apps/website/README.md).

## 2. Check the environment

```bash
node --version      # ≥ 24.20 (package.json engines)
pnpm --version      # 11.23.0 (packageManager)
git status --short  # see what other agents may have in flight
```

If `node_modules/` is missing, ask the lockfile owner to run `pnpm install`;
do not run it yourself in a shared checkout.

## 3. Run the baseline

```bash
pnpm check   # lint + typecheck + tests: 1 file, 5 tests today
pnpm build   # astro check + astro build of the website
```

Both must pass before you start. If one fails on a clean checkout, report it
with the failing command instead of working around it.

## 4. Know where things live

| You want to… | Go to |
| --- | --- |
| Add framework-free behavior or policy | `packages/core/src/<area>/`, tests in `packages/core/tests/` (skill: `add-texel`) |
| Add or change a website page | `apps/website/src/pages/` and `src/components/` (skill: `add-website-page`) |
| Fix a lint or type error | skill: `fix-lint` |
| Pick validation gates | [`TESTING_GUIDE.md`](TESTING_GUIDE.md) |
| Plan multi-step work | `/dwp-create` (see the DWP block in `AGENTS.md`) |
| Review your diff | `/code-review` (AI Diff Reviewer, with `.review/extension.md`) |
| Scratch output | `tmp/` (git-ignored) |

## 5. Remember the hard lines

- Local only: never push, never add a remote, never run a writing `gh`
  command.
- Commit only when asked, staging exact paths.
- No other component library; no `{@html}`, `eval` or `new Function` on data.
- Owner-held files (`package.json`, `pnpm-lock.yaml`,
  `pnpm-workspace.yaml`, `biome.json`, `tsconfig.base.json`,
  `vitest.config.ts`) change only with the owner.
- Mark planned work as planned in every doc you touch.
