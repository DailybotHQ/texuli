# AGENTS.md — Texuli

**Purpose:** the single entry point for every AI coding agent (Claude Code,
Codex, Cursor, Gemini, Copilot, Cline, OpenCode…) and human contributor.
`CLAUDE.md` is a symlink to this file. Keep it lean; the details live in the
linked docs.

DWP standard: 7.0.0 (onboarded 2026-10-22; upgraded 2026-10-27; skill 7.10.0)

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
- the **agent catalog** renders agent output with no HTML sinks, and the
  blueprint contract (`@texuli/spec`) also feeds a Kotlin Multiplatform
  twin in `native/`.

**Status: in development, pre-1.0.** All 26 published packages (all of
`packages/` except `@texuli/examples`) are released on npm in the 0.10 line:
7 at `0.10.0` (core, date, deck, drag, document, primitives, spec) and 19 at `0.10.1` (G125–G127 and their exact-pin dependents), which the publish workflow publishes from `main`
after the merge and points `latest` and `next` to; `0.10.0` adds design
systems (one JSON document per brand, [DESIGN_SYSTEMS](docs/DESIGN_SYSTEMS.md)),
and `@texuli/drag`, `@texuli/workflows`, `@texuli/deck`, `@texuli/editor`,
`@texuli/document`, `@texuli/pages`, `@texuli/forms`, `@texuli/canvas`,
`@texuli/sheets` and `@texuli/mcp` are still in development
([RELEASE](docs/RELEASE.md)). Workspace packages stay
`private: true`, and no stable release is out (1.0.0 will be the first; under
0.x a new minor may break; see [RELEASE](docs/RELEASE.md)),
and texuli.com deploys from `main` to Cloudflare Pages, with the Pages
Functions in `functions/`. See
[docs/PRODUCT_SPEC.md](docs/PRODUCT_SPEC.md) and
[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Documentation index

| Area | Doc | What it covers |
| --- | --- | --- |
| Product | [PRODUCT_SPEC](docs/PRODUCT_SPEC.md) | Problem, consumers, capabilities, non-goals, release status |
| Releases | [RELEASE](docs/RELEASE.md) | Independent package versions, 0.x versioning, prerelease and stable dist-tags, owner-GO publication waves |
| Architecture | [ARCHITECTURE](docs/ARCHITECTURE.md) | The down-only layer graph (L0 core and spec … L8 tools and astro, L9 mcp), every package and subpath, engines, the website, build and test shape |
| Decisions | [DECISIONS](docs/DECISIONS.md) | Architecture decisions: options, choice, why, how to reverse |
| Design language | [DESIGN_LANGUAGE](docs/DESIGN_LANGUAGE.md) · [EDITOR_ARCHITECTURE](docs/EDITOR_ARCHITECTURE.md) | The cross-surface visual contract; the rich text editor's contracts (ADR-003) |
| Design systems | [DESIGN_SYSTEMS](docs/DESIGN_SYSTEMS.md) | One JSON document per brand: author, import, validate (codes), compile, apply, patches and variants, distribute, guarantees, conformance, outputs; example brands in `examples/design-systems/` (released in `0.10.0`) |
| Standards | [STANDARDS](docs/STANDARDS.md) | TypeScript, Svelte 5, Biome, CSS logical properties, naming, a11y, honesty |
| Testing | [TESTING_GUIDE](docs/TESTING_GUIDE.md) | Every gate with verified results, source→test map, blind spots, posture |
| Commands | [DEVELOPMENT_COMMANDS](docs/DEVELOPMENT_COMMANDS.md) | Every root and package script, scoped variants |
| Security | [SECURITY](docs/SECURITY.md) | Threat model: URL policy, HTML sinks, untrusted agent output, CSP, supply chain, edge functions and analytics |
| CI | [CI](docs/CI.md) | GitHub Actions: checks, behavior suite, website, npm publishing waves, Cloudflare Pages deployment, budget audits |
| Accessibility | [ACCESSIBILITY](docs/ACCESSIBILITY.md) | The accessibility contract and its checks |
| Performance | [PERFORMANCE](docs/PERFORMANCE.md) | Size budgets, measured numbers, perf tests |
| Quality reports | [docs/quality/](docs/README.md#quality-reports-docsquality) | a11y sweeps, consumers, CSP, SSR, packaging, perf, supply chain, screen-reader transcripts |
| Onboarding | [AI_AGENT_ONBOARDING](docs/AI_AGENT_ONBOARDING.md) | First-session checklist |
| Collaboration | [AI_AGENT_COLLAB](docs/AI_AGENT_COLLAB.md) | Path ownership, owner-held files, commits in a shared checkout, handoffs |
| Index | [docs/README](docs/README.md) | Every guide: repository, package, website and quality docs |
| Packages | [core](packages/core/README.md) · [date](packages/date/README.md) · [deck](packages/deck/README.md) · [drag](packages/drag/README.md) · [primitives](packages/primitives/README.md) · [tokens](packages/tokens/README.md) · [texuli](packages/texuli/README.md) · [charts](packages/charts/README.md) · [data](packages/data/README.md) · [media](packages/media/README.md) · [chat](packages/chat/README.md) · [workflows](packages/workflows/README.md) · [blocks](packages/blocks/README.md) · [catalog](packages/catalog/README.md) · [slides](packages/slides/README.md) · [player](packages/player/README.md) · [tools](packages/tools/README.md) · [mcp](packages/mcp/README.md) · [astro](packages/astro/README.md) · [spec](packages/spec/README.md) · [editor](packages/editor/README.md) · [document](packages/document/README.md) · [pages](packages/pages/README.md) · [forms](packages/forms/README.md) · [canvas](packages/canvas/README.md) · [sheets](packages/sheets/README.md) · [examples](packages/examples/README.md) | Each package's front page; its `docs/*.md` describe every subpath |
| Website | [apps/website](apps/website/README.md) | texuli.com (Astro 7 + Svelte islands); area designs in `apps/website/docs/` |
| Agent service | [apps/agent](apps/agent/README.md) | The texuli.com agent service: prompt → validated blueprint draft, fake replay provider only, not deployed |
| Native | [native](native/README.md) | The Gradle Kotlin Multiplatform twin (`texuli-spec`, `texuli-compose`, `conformance`); not a pnpm package |
| Agent skill | [skills/texuli](skills/texuli/SKILL.md) | The distributable skill for building with Texuli (`pnpm check:skill`) |
| Test suites | [behavior](tests/behavior/README.md) · [visual](tests/visual/README.md) | The primitives behavior suite; visual baselines |
| Kit | [.agents catalog](.agents/docs/skills_agents_catalog.md), [commands](.agents/docs/COMMANDS_REFERENCE.md) | Skills, agents, slash commands |
| Review rules | [.review/extension.md](.review/extension.md) | Texuli overrides for the AI Diff Reviewer local review |

## Repository structure

```text
texuli/
├── packages/            layers point down only (scripts/check-layers.ts)
│   ├── core/            L0 @texuli/core: texels (overlay engine, roving, positioning, URL policy…)  (README, docs/)
│   ├── date/            L0 @texuli/date: Gregorian date arithmetic and locale week starts      (README)
│   ├── deck/            L0 @texuli/deck: deck model v2 from JSON or Markdown, engine, authoring (in development, on npm as 0.10.0) (README, docs/)
│   ├── drag/            L0 @texuli/drag: framework-free drag engine (in development, on npm as 0.10.0) (README, docs/)
│   ├── primitives/      L1 @texuli/primitives: 42 owned headless primitives, APG patterns      (README, docs/)
│   ├── document/        L1 @texuli/document: block document engine, ops, Markdown, CRDT sync (in development, on npm since 0.7.0) (README, docs/)
│   ├── tokens/          L2 @texuli/tokens: OKLCH theme engine, --tx-* contract, 200+ themes, CSS (README, docs/)
│   ├── texuli/          L3 texuli: styled components, cx/variants, icons, layouts, shells      (README, docs/)
│   ├── charts/          L4 @texuli/charts: chart math + every family, one subpath each         (README, docs/)
│   ├── data/            L4 @texuli/data: grid, tree, board, calendar, timeline, map, files…    (README, docs/)
│   ├── media/           L4 @texuli/media: image, gallery, video, audio, editor, compositions   (README, docs/)
│   ├── chat/            L4 @texuli/chat: thread, messages, composer                            (README, docs/)
│   ├── blocks/          L5 @texuli/blocks: content blocks for pages, documents and slides      (README, docs/)
│   ├── spec/            L0 @texuli/spec: the blueprint contract, schemas, TS + Kotlin codegen   (README)
│   ├── editor/          L4 @texuli/editor: rich text editor, Markdown in/out (in development, on npm since 0.5.0) (README, docs/)
│   ├── workflows/       L4 @texuli/workflows: workflow editor, viewer, model, layout (in development) (README)
│   ├── forms/           L4 @texuli/forms: schema-driven forms, conditions, steps, drafts (in development, first on npm as 0.8.0) (README, docs/)
│   ├── canvas/          L4 @texuli/canvas: infinite canvas, CRDT sync, SVG/PNG export (in development, first on npm as 0.8.0) (README, docs/)
│   ├── sheets/          L5 @texuli/sheets: spreadsheets, owned formula engine, CSV, sheet view (in development, first on npm as 0.8.0) (README, docs/)
│   ├── catalog/         L6 @texuli/catalog: agent catalog + sink-free renderer                 (README, docs/)
│   ├── player/          L7 @texuli/player: paint runtime for validated blueprints              (README, docs/)
│   ├── slides/          L8 @texuli/slides: presentation stage on @texuli/deck, print, PPTX (README, docs/)
│   ├── tools/           L8 @texuli/tools: CLI, llms, A2UI, custom elements, golden set, MCP     (README, docs/)
│   ├── astro/           L8 @texuli/astro: Astro integration, content layouts, sections          (README, docs/)
│   ├── pages/           L8 @texuli/pages: block document editor and reader (in development, on npm since 0.7.0) (README, docs/)
│   ├── mcp/             L9 @texuli/mcp: local MCP server bin, npx -y @texuli/mcp (in development, first on npm as 0.9.0) (README, docs/)
│   └── examples/        @texuli/examples (private): the examples registry for tests, visuals and the site
├── apps/
│   ├── website/         @texuli/website: texuli.com, Astro 7 + Svelte islands                  (README, docs/)
│   └── agent/           @texuli/agent: the agent service (fake replay provider; not deployed)   (README, docs/)
├── functions/           Cloudflare Pages Functions: _middleware.ts (Markdown twins, robots variant,
│                        problem+json 404s, bot events), api/umami (same-origin analytics proxy)
│                        and mcp.ts (the remote MCP at /mcp, stateless, edge and site operations)
├── native/              Gradle Kotlin Multiplatform twin: texuli-spec, texuli-compose, conformance (README, docs/)
├── .github/workflows/   CI (checks, behavior, website, budget audits) and the npm publish workflow
├── skills/texuli/       the distributable agent skill (setup.sh, SHA256SUMS)
├── tests/
│   ├── behavior/        primitives behavior suite (scenarios + rows, chromium and webkit)
│   ├── e2e/             Playwright specs: a11y sweeps, CSP, SSR, site-*.spec.ts, components
│   ├── visual/          visual baselines (light/dark, desktop/Pixel 7)
│   ├── consumers/       Vite, Astro and SvelteKit apps installing the packed tarballs
│   ├── perf/            opt-in wall-clock and scale limits (pnpm test:perf)
│   ├── fixtures/        the fixture app (tests/fixtures/app) and hostile inputs
│   └── setup/           Vitest setup
├── scripts/             check-layers, check-skill, size, visual, packages, supply-chain (+ tests/)
├── docs/                the guides above, plus docs/quality/
├── brand/               logos and favicons
├── examples/design-systems/  fictional example brands (design-system documents; docs/DESIGN_SYSTEMS.md)
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
| Lint + format | `pnpm lint` (Biome + `check:trojan-source`) · `pnpm lint:fix` · `pnpm format` | `npx biome check <path>` |
| Type check | `pnpm typecheck` | `pnpm --filter <package> typecheck` |
| Unit + component tests | `pnpm test` | `pnpm vitest run packages/<pkg>` · `pnpm vitest run <file>` · `-t "<name>"` |
| Agent service tests (not in `pnpm test`) | `pnpm --filter @texuli/agent exec vitest run` | `… vitest run tests/<file>.test.ts` |
| Docs links and commands | `pnpm check:docs` | — |
| Layer guard | `pnpm check:layers` | — |
| Fast full gate | `pnpm check` (lint, typecheck, test, layers, surfaces) | — |
| Behavior suite (primitives) | `pnpm exec playwright test tests/behavior` | `… tests/behavior/scenarios/<primitive>.spec.ts` |
| Browser checks | `pnpm test:e2e` | `pnpm exec playwright test <spec> [--project chromium]` |
| Visual regression | `pnpm visual` (`pnpm visual:update` to rebaseline) | `pnpm visual -g <example-id>` |
| Size budgets | `pnpm size` | `pnpm size --filter <dir>` |
| Packaging (no publish) | `pnpm verify:packages` | `pnpm verify:packages --filter <dirs>` |
| Perf limits (opt-in) | `pnpm test:perf` | — |
| Agent skill | `pnpm check:skill` | — |
| Agent surfaces (server card, llms Tools, ops docs) | `pnpm check:surfaces` | `pnpm exec tsx scripts/generate-surfaces.ts` (rewrite) |
| Website build | `pnpm build` (then `tests/e2e/site-*.spec.ts`) | — |
| Native twin (JDK 21, not in `pnpm check`) | `./native/gradlew -p native check` | — |
| Repository conformance (read-only) | `bash .agents/skills/deepworkplan/verify/conformance.sh --repo-only` | — |

A `-t` filter that matches nothing exits 0 with every test skipped; always
confirm a non-zero `passed` count. Verified results and the source→test map:
[TESTING_GUIDE](docs/TESTING_GUIDE.md). Every script:
[DEVELOPMENT_COMMANDS](docs/DEVELOPMENT_COMMANDS.md).

## Mandatory rules

1. **English only** in code, comments, UI copy, docs and commits.
2. **Conventional Commits**: `type(scope): summary`. Scopes: `core`,
   `spec`, `deck`, `drag`, `primitives`, `tokens`, `texuli`, `charts`, `data`, `media`,
   `chat`, `editor`, `document`, `pages`, `forms`, `canvas`, `sheets`, `workflows`, `blocks`, `catalog`, `slides`, `player`, `tools`,
   `mcp`, `astro`, `examples`, `website` (also `functions/`), `agent`, `native`,
   `skill`, `e2e`, `visual`, `consumers`, `scripts`, `docs`, `deps`, `ci`,
   `dwp` (the `.agents/`, `.review/` and `.dwp/` harness). **Stage exact paths**, never
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
    check results. The 26 published packages, including `@texuli/mcp`
    (first published in `0.9.0`), are released on npm in the 0.10 line
    (see docs/RELEASE.md; dist-tags `latest` and `next`, published by CI
    with provenance); `@texuli/drag`, `@texuli/workflows`,
    `@texuli/deck`, `@texuli/editor`, `@texuli/document`, `@texuli/pages`,
    `@texuli/forms`, `@texuli/canvas`, `@texuli/sheets` and `@texuli/mcp`
    are still in development, and the blueprint spec in
    `@texuli/spec@0.10.0` is `0.10.0`. `@texuli/examples`, the apps and
    `native/` publish nothing. The 0.10 line is a pre-1.0 release, not stable
    (1.0.0 will be the first stable release; `latest` tracks the newest
    release). texuli.com deploys from `main` (Cloudflare Pages), with the
    remote MCP at `https://texuli.com/mcp`; the agent service is not
    deployed.
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
| Primitives behave | `TEXULI_E2E_PORT=<port> pnpm exec playwright test tests/behavior` passes on chromium and webkit |
| Looks right | `pnpm visual` reports no changes (new examples commit their baselines) |
| Fits its budget | `pnpm size` reports every entry within budget |
| Ships cleanly | `pnpm verify:packages` passes (packs; publishes nothing) |
| The website builds | `pnpm build` exits 0, then the area's `tests/e2e/site-*.spec.ts` passes |
| The harness conforms | `bash .agents/skills/deepworkplan/verify/conformance.sh --repo-only` prints `CONFORMANT` (in the main checkout) |
| Docs are honest | `pnpm exec tsx scripts/check-docs.ts` passes (links resolve, commands name real scripts and paths), and every cheap documented command runs |

Not covered automatically: screen-reader experience beyond the recorded
transcripts, Firefox, real deployments (including the Pages Functions on
Cloudflare's runtime), and, in CI, the agent service tests and the native
Gradle build (both run locally only). See
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
