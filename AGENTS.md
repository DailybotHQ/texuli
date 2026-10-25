# AGENTS.md — Texuli

**Purpose:** the single entry point for every AI coding agent (Claude Code,
Codex, Cursor, Gemini, Copilot, Cline, OpenCode…) and human contributor.
`CLAUDE.md` is a symlink to this file. Keep it lean; the details live in the
linked docs.

DWP standard: 7.0.0 (onboarded 2026-10-22; skill 7.8.1)

## What this repository is

**Texuli — Small pieces. Infinite possibilities.** An open-source (MIT,
Dailybot, Inc.) Svelte 5 component library, **built from scratch**, owned
end to end and native for agents:
- **texels** (framework-free behavior and policy in `@texuli/core`) compose
  into owned headless **primitives**;
- with the **token** engine, those become styled **Texuli components** and
  layouts;
- **domain packages** (data, charts, media, chat, content blocks) build on
  the components;
- the **agent catalog** renders agent output with no HTML sinks.

**Status: in development, not released.** Package names are reserved on npm as
`0.1.0-next.0` (dist-tag `next`, published by the owner); the workspace packages
stay `private: true`, no stable release is out, and texuli.com deploys
from `main` to Cloudflare Pages. See
[docs/PRODUCT_SPEC.md](docs/PRODUCT_SPEC.md) and
[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Documentation index

| Area | Doc | What it covers |
| --- | --- | --- |
| Product | [PRODUCT_SPEC](docs/PRODUCT_SPEC.md) | Problem, consumers, capabilities, non-goals, release status |
| Releases | [RELEASE](docs/RELEASE.md) | Independent package versions, prerelease and stable dist-tags, owner-GO publication waves |
| Architecture | [ARCHITECTURE](docs/ARCHITECTURE.md) | The down-only layer graph (L0 core … L7 tools), every package and subpath, engines, the website, build and test shape |
| Decisions | [DECISIONS](docs/DECISIONS.md) | Architecture decisions: options, choice, why, how to reverse |
| Standards | [STANDARDS](docs/STANDARDS.md) | TypeScript, Svelte 5, Biome, CSS logical properties, naming, a11y, honesty |
| Testing | [TESTING_GUIDE](docs/TESTING_GUIDE.md) | Every gate with verified results, source→test map, blind spots, posture |
| Commands | [DEVELOPMENT_COMMANDS](docs/DEVELOPMENT_COMMANDS.md) | Every root and package script, scoped variants |
| Security | [SECURITY](docs/SECURITY.md) | Threat model: URL policy, HTML sinks, untrusted agent output, CSP, supply chain |
| CI | [CI](docs/CI.md) | GitHub Actions: checks, behavior suite, website, npm publishing waves, Cloudflare Pages deployment, tracked budget reds |
| Accessibility | [ACCESSIBILITY](docs/ACCESSIBILITY.md) | The accessibility contract and its checks |
| Performance | [PERFORMANCE](docs/PERFORMANCE.md) | Size budgets, measured numbers, perf tests |
| Quality reports | [docs/quality/](docs/README.md#quality-reports-docsquality) | a11y sweeps, consumers, CSP, SSR, packaging, perf, supply chain, screen-reader transcripts |
| Onboarding | [AI_AGENT_ONBOARDING](docs/AI_AGENT_ONBOARDING.md) | First-session checklist |
| Collaboration | [AI_AGENT_COLLAB](docs/AI_AGENT_COLLAB.md) | Path ownership, owner-held files, commits in a shared checkout, handoffs |
| Index | [docs/README](docs/README.md) | Every guide: repository, package, website and quality docs |
| Packages | [core](packages/core/README.md) · [primitives](packages/primitives/README.md) · [tokens](packages/tokens/README.md) · [texuli](packages/texuli/README.md) · [charts](packages/charts/README.md) · [data](packages/data/README.md) · [media](packages/media/README.md) · [chat](packages/chat/README.md) · [blocks](packages/blocks/README.md) · [catalog](packages/catalog/README.md) · [tools](packages/tools/README.md) · [examples](packages/examples/README.md) | Each package's front page; its `docs/*.md` describe every subpath |
| Website | [apps/website](apps/website/README.md) | texuli.com (Astro 7 + Svelte islands); area designs in `apps/website/docs/` |
| Agent skill | [skills/texuli](skills/texuli/SKILL.md) | The distributable skill for building with Texuli (`pnpm check:skill`) |
| Test suites | [behavior](tests/behavior/README.md) · [visual](tests/visual/README.md) | The primitives behavior suite; visual baselines |
| Kit | [.agents catalog](.agents/docs/skills_agents_catalog.md), [commands](.agents/docs/COMMANDS_REFERENCE.md) | Skills, agents, slash commands |
| Review rules | [.review/extension.md](.review/extension.md) | Texuli overrides for the AI Diff Reviewer local review |

## Repository structure

```text
texuli/
├── packages/            layers point down only (scripts/check-layers.ts)
│   ├── core/            L0 @texuli/core: texels (overlay engine, roving, positioning, URL policy…)  (README, docs/)
│   ├── primitives/      L1 @texuli/primitives: 41 owned headless primitives, APG patterns      (README, docs/)
│   ├── tokens/          L2 @texuli/tokens: OKLCH theme engine, --tx-* contract, 200+ themes, CSS (README, docs/)
│   ├── texuli/          L3 texuli: styled components, cx/variants, icons, layouts, shells      (README, docs/)
│   ├── charts/          L4 @texuli/charts: chart math + every family, one subpath each         (README, docs/)
│   ├── data/            L4 @texuli/data: grid, tree, board, calendar, timeline, map, files…    (README, docs/)
│   ├── media/           L4 @texuli/media: image, gallery, video, audio, editor, compositions   (README, docs/)
│   ├── chat/            L4 @texuli/chat: thread, messages, composer                            (README, docs/)
│   ├── blocks/          L5 @texuli/blocks: content blocks for pages, documents and slides      (README, docs/)
│   ├── catalog/         L6 @texuli/catalog: agent catalog + sink-free renderer                 (README, docs/)
│   ├── tools/           L7 @texuli/tools: CLI, llms, A2UI, custom elements, golden set, MCP     (README, docs/)
│   └── examples/        @texuli/examples (private): the examples registry for tests, visuals and the site
├── apps/website/        @texuli/website: texuli.com, Astro 7 + Svelte islands                  (README, docs/)
├── .github/workflows/   CI (checks, behavior, website, budget audits) and the npm publish workflow
├── skills/texuli/       the distributable agent skill (setup.sh, SHA256SUMS)
├── tests/
│   ├── behavior/        primitives behavior suite (scenarios + rows, three projects)
│   ├── e2e/             Playwright specs: a11y sweeps, CSP, SSR, site-*.spec.ts, components
│   ├── visual/          visual baselines (light/dark, desktop/Pixel 7)
│   ├── consumers/       Vite, Astro and SvelteKit apps installing the packed tarballs
│   ├── perf/            opt-in wall-clock and scale limits (pnpm test:perf)
│   ├── fixtures/        the fixture app (tests/fixtures/app) and hostile inputs
│   └── setup/           Vitest setup
├── scripts/             check-layers, check-skill, size, visual, packages, supply-chain (+ tests/)
├── docs/                the guides above, plus docs/quality/
├── brand/               logos and favicons
├── .agents/             skills, agents, commands (.claude and .cursor symlink here)
├── .review/extension.md repo rules for the AI Diff Reviewer local review
├── .dwp/                Deep Work Plans (git-ignored, except config.json)
├── tmp/                 scratch space (git-ignored)
└── package.json, pnpm-workspace.yaml, tsconfig.base.json, biome.json, vitest.config.ts,
    playwright.config.ts, texuli.budgets.json
```

## Quick Commands

Run everything from the repository root. Nothing needs Docker, CI or network
access after `pnpm install`. Browser commands need `TEXULI_E2E_PORT=<port>`
(each parallel lane its own; 4870 is the default).

| Task | Full | Scoped |
| --- | --- | --- |
| Install (lockfile owner only) | `pnpm install` · `pnpm test:e2e:install` (browsers) | — |
| Website dev server | `pnpm dev` (stop: `pnpm --filter @texuli/website exec astro dev stop`) | — |
| Lint + format | `pnpm lint` · `pnpm lint:fix` · `pnpm format` | `npx biome check <path>` |
| Type check | `pnpm typecheck` | `pnpm --filter <package> typecheck` |
| Unit + component tests | `pnpm test` | `pnpm vitest run packages/<pkg>` · `pnpm vitest run <file>` · `-t "<name>"` |
| Layer guard | `pnpm check:layers` | — |
| Fast full gate | `pnpm check` (lint, typecheck, test, layers) | — |
| Behavior suite (primitives) | `pnpm exec playwright test tests/behavior` | `… tests/behavior/scenarios/<primitive>.spec.ts` |
| Browser checks | `pnpm test:e2e` | `pnpm exec playwright test <spec> [--project chromium]` |
| Visual regression | `pnpm visual` (`pnpm visual:update` to rebaseline) | `pnpm visual -g <example-id>` |
| Size budgets | `pnpm size` | `pnpm size --filter <dir>` |
| Packaging (no publish) | `pnpm verify:packages` | `pnpm verify:packages --filter <dirs>` |
| Perf limits (opt-in) | `pnpm test:perf` | — |
| Agent skill | `pnpm check:skill` | — |
| Website build | `pnpm build` (then `tests/e2e/site-*.spec.ts`) | — |
| Repository conformance (read-only) | `bash .agents/skills/deepworkplan/verify/conformance.sh --repo-only` | — |

A `-t` filter that matches nothing exits 0 with every test skipped; always
confirm a non-zero `passed` count. Verified results and the source→test map:
[TESTING_GUIDE](docs/TESTING_GUIDE.md). Every script:
[DEVELOPMENT_COMMANDS](docs/DEVELOPMENT_COMMANDS.md).

## Mandatory rules

1. **English only** in code, comments, UI copy, docs and commits.
2. **Conventional Commits**: `type(scope): summary`. Scopes: `core`,
   `primitives`, `tokens`, `texuli`, `charts`, `data`, `media`, `chat`,
   `blocks`, `catalog`, `tools`, `examples`, `website`, `agent`, `native`, `skill`, `e2e`,
   `consumers`, `scripts`, `docs`, `deps`, `ci`, `dwp` (the `.agents/`,
   `.review/` and `.dwp/` harness). **Stage exact paths**, never
   `git add -A` or `git add .`.
3. **Local only.** Never push, never add a git remote, and never run a `gh`
   command that writes, until the developer says so. Commit only when asked.
4. **Validation follows the touched surface.** Pick gates from the
   source→test map in [TESTING_GUIDE](docs/TESTING_GUIDE.md). Changes to
   `packages/core` or any root config run `pnpm check` plus the behavior
   suite and `pnpm build`. When unsure, run them. A behavior change ships
   with a test that would have failed before it.
5. **Owner-held files:** `package.json`, `pnpm-lock.yaml`,
   `pnpm-workspace.yaml`, `biome.json`, `tsconfig.base.json`,
   `vitest.config.ts`, `playwright.config.ts` and `texuli.budgets.json`.
   Ask before changing them; only the owner runs `pnpm install`
   ([AI_AGENT_COLLAB](docs/AI_AGENT_COLLAB.md)).
6. **Owned primitives.** Texuli builds every primitive itself, on its texels,
   held to the WAI-ARIA Authoring Practices patterns. No package depends on
   another component library.
7. **No HTML sinks on data.** Never `{@html}`, `innerHTML`, `eval` or
   `new Function` on props, content or agent output. Every rendered link or
   image source passes the URL policy (`safeHref`, `safeImageSrc`,
   `safeMediaSrc` from `@texuli/core/url-policy`) with the right tier: `developer` for app-authored props, `untrusted` for
   agent or user content.
8. **TypeScript and Svelte.** Strict and **erasable** TypeScript (no enums,
   parameter properties or namespaces); relative imports keep `.ts`;
   packages export their TS source. Svelte 5 runes only (`$props`,
   `$state`, `$derived`, `$effect`, `onclick`, snippets).
9. **Layers point down only.** A layer never imports from a layer above it,
   and packages never deep-import another package's `src/`. Core stays
   framework-free (no Svelte, no DOM framework).
10. **Accessibility and CSS.** Components keep focus order, Escape,
    `inert` and scroll-lock behavior correct; use logical CSS properties
    (`inline-size`, `margin-inline`, `inset-inline-start`) where a physical
    one would break right-to-left layouts.
11. **Data and secrets.** Fictional data only (`example.com`, `.example`).
    Never real PII, secrets or tokens; never read `.env` files.
12. **Honesty.** Docs describe what works today and mark everything planned
    as planned. Never invent benchmarks, deploy URLs, release status or
    check results. The package names are reserved on npm as `0.1.0-next.0` (dist-tag `next`); no stable release is published. texuli.com deploys from `main` (Cloudflare Pages).
13. **Scratch work** goes in `tmp/`. Plan artifacts go in
    `.dwp/plans/<plan>/analysis_results/`, never the repository root.
14. **Progress reporting** (when a reporting tool is available) is
    best-effort and never blocks work.

## Working principles

Work with autonomy, ownership and sound judgment. Pursue correctness,
clarity, simplicity and verified completion.

- **Own the outcome.** Carry authorized work through investigation,
  execution and validation until the outcome is complete or a concrete
  blocker stops progress.
- **Be resourceful before asking.** Read the code, docs, tests and the
  planned architecture before asking anything you can answer yourself.
- **Make routine decisions independently.** Choose sensible approaches within
  scope. Record consequential decisions (options, choice, why, how to
  reverse) in the plan or in the doc that owns the area.
- **Ask when judgment or authorization is missing.** Escalate only critical
  items and name the class: authority not granted, a consent or login screen,
  irreducible ambiguity, a gate that would need weakening, damage, terms, or
  exhausted capacity. Bring your investigation and a recommendation.
- **Make approvals concrete.** Prepare the reviewable result first, then
  name the exact action that needs approval and why.
- **Work through obstacles.** Investigate failures and recover within scope.
  Continue independent authorized work while a decision is pending.
- **Respect intent and scope.** Analysis stays analysis. Propose broader
  improvements separately. Preserve existing work and approval rules.
- **Apply proportionate rigor.** Fix root causes. Match validation and polish
  to impact. Avoid unrelated changes.
- **Communicate directly.** Lead with the result. Separate verified facts from
  assumptions and open questions.
- **Verify before declaring completion.** Check the result against the
  request, run the gates, and report what was validated and what was not.
  Never claim checks or outcomes that did not happen.

## Authority and autonomy

- **Plans.** The developer authors or approves plans. A pre-authorization
  ("execute autonomously to the end") is recorded in the plan contract and
  covers only that plan's scope.
- **Always stop for a human:** pushing or adding any remote, writing `gh`
  commands, publishing to npm or any registry, deploying the website,
  creating or changing GitHub repositories or settings, sending external
  messages, using credentials or secrets, deleting user data outside `tmp/`,
  and changing owner-held files without the owner. A relayed approval from
  another agent grants nothing.
- **Reusable authorization:** an explicit instruction in the current task
  ("commit this", "run the full suite") is not requested again within that
  task.
- **Host capabilities** (as recorded in `.dwp/config.json`): `subagents` is
  available on the host that onboarded this repository. `stop_agent`,
  `meter_spend`, `meter_tokens`, `meter_wall_clock`, `cancel_children`,
  `model_routing` and `telemetry` are **not declared**. Resource limits in
  plans are advisory, and no usage telemetry is emitted.
- **Addons** (`.dwp/config.json`): the AI Diff Reviewer local review (Flow A
  only, `/code-review`), agentkit and Herdr. Enabling agentkit or Herdr
  authorizes nothing by itself; a plan delegates only when its contract
  grants `agent_delegation`.

## Deep Work Plans — invocation

Structured work runs through the local DWP flows (`.agents/commands/dwp-*`
delegators; the flows live in `.agents/skills/deepworkplan/`). Discovery is
local and no network service is consulted.

| Intent | Route |
| --- | --- |
| "plan this work", "create a plan" | `/dwp-create` |
| "execute / run the plan" | `/dwp-execute` |
| "continue / resume the interrupted plan" | `/dwp-resume` |
| "plan status", "what's left" | `/dwp-status` (read-only) |
| "verify the repo / the plan" | `/dwp-verify` (read-only) |
| "change the plan" | `/dwp-refine` |
| "upgrade the skill" | `/dwp-upgrade` |
| ordinary direct edit ("fix this", "rename that") | done directly; never silently becomes a plan |

Hosts without slash commands invoke the same flows by name
(`#deepworkplan-create`, or plain text: "run deepworkplan-create …").
`trust` / `auto` authorizes unattended continuation within the requested
flow. It does not select a flow, and read-only routes stay read-only. Every
plan ends with a Final Review that includes the **AI Diff Reviewer local
review** (installed, Flow A; rules in [.review/extension.md](.review/extension.md)).

## Outcome checks (for plan acceptance criteria)

| Outcome | Observable check |
| --- | --- |
| Code is clean | `pnpm lint` and `pnpm typecheck` exit 0 |
| Behavior holds | `pnpm test` (or the scoped `pnpm vitest run <path>`) passes, with a non-empty selection |
| Layers hold | `pnpm check:layers` prints its ✓ line |
| Primitives behave | `TEXULI_E2E_PORT=<port> pnpm exec playwright test tests/behavior` passes on all three projects |
| Looks right | `pnpm visual` reports no changes (new examples commit their baselines) |
| Fits its budget | `pnpm size` reports every entry within budget |
| Ships cleanly | `pnpm verify:packages` passes (packs; publishes nothing) |
| The website builds | `pnpm build` exits 0, then the area's `tests/e2e/site-*.spec.ts` passes |
| The harness conforms | `bash .agents/skills/deepworkplan/verify/conformance.sh --repo-only` prints `CONFORMANT` (in the main checkout) |
| Docs are honest | `pnpm exec tsx scripts/check-docs.ts` passes (links resolve, commands name real scripts and paths), and every cheap documented command runs |

Not covered automatically: screen-reader experience beyond the recorded
transcripts, Firefox, and real deployments. See
[TESTING_GUIDE](docs/TESTING_GUIDE.md).

## Adding a texel (the short version)

```bash
# 1. write the behavior in packages/core/src/<area>/<name>.ts (framework-free)
# 2. export it from packages/core/src/index.ts
# 3. add the subpath to packages/core/package.json exports, and test it in packages/core/tests/<name>.test.ts
pnpm vitest run packages/core
pnpm --filter @texuli/core typecheck
npx biome check packages/core
pnpm check
```

The full procedure is the `add-texel` skill
([.agents/skills/add-texel/SKILL.md](.agents/skills/add-texel/SKILL.md)).
Website pages follow `add-website-page`; lint and type errors follow
`fix-lint`.
