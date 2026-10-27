# Skills & Agents Catalog

Everything in Texuli's agent kit, as it exists on disk. Update this file in
the same change whenever a skill, agent or command is added, renamed or
removed (`/skill-create` and `/agent-create` do this through the DWP author
flow). Command invocation forms are in [COMMANDS_REFERENCE.md](COMMANDS_REFERENCE.md).

**Tiers** are abstract: `light` (mechanical), `standard` (most engineering),
`heavy` (architecture, security). Agent files set `model: inherit`; map tiers
to concrete models in your harness, in one place (see [../README.md](../README.md)).

## Agents (`.agents/agents/`)

| Agent | Tier | Writes code | Use for |
| --- | --- | --- | --- |
| [reviewer](../agents/reviewer.md) | standard | no | Review a diff for layer direction, owned primitives, URL policy, accessibility and honest docs |
| [architect](../agents/architect.md) | heavy | no | Cross-layer design, new packages, texel and catalog contracts |
| [executor](../agents/executor.md) | standard | yes | Implement a scoped task with tests and surface gates |
| [debugger](../agents/debugger.md) | standard | yes | Root-cause a failing test, type error or build, fix with a regression test |
| [qa](../agents/qa.md) | standard | tests only | Map behaviors to tests and add the missing ones |
| [perf-optimizer](../agents/perf-optimizer.md) | standard | yes | Measured work on package size budgets, website page weight and client JavaScript, and hot paths |
| [security-auditor](../agents/security-auditor.md) | heavy | no | Audit HTML sinks, the URL policy, untrusted output, the site CSP and middleware, the agent service, supply chain, secrets |
| [primitive-author](../agents/primitive-author.md) | standard | yes | Owned primitives: L0 texels plus the L1 Svelte parts in `@texuli/primitives`, with unit, behavior-suite and a11y tests |
| [docs-site-author](../agents/docs-site-author.md) | standard | yes | texuli.com pages in `apps/website`: static, accessible, CSP-covered, honest |

## Repository skills (`.agents/skills/`)

| Skill | Tier | Intent | Use for |
| --- | --- | --- | --- |
| [add-texel](../skills/add-texel/SKILL.md) | standard | create | Framework-free behavior in `packages/core` with a subpath export, JSDoc contract, contract doc and tests |
| [add-website-page](../skills/add-website-page/SKILL.md) | standard | create | A texuli.com page through `BaseLayout` and the nav source: SEO, breadcrumbs, sitemap, Markdown twin, `llms.txt`, covering CSP |
| [fix-lint](../skills/fix-lint/SKILL.md) | light | fix | Biome, tsc, astro check and layer-guard errors, erasable-syntax and strict-mode pitfalls |

## Distributable skill (`skills/texuli/`)

Not part of this kit: the skill pack Texuli ships to people building with it
(router plus `build-ui`, `components`, `themes`, `media`, `blueprints`,
`contribute` and `evals` sub-skills). Its `contribute` sub-skill is also the
detailed procedure for primitives, styled components, catalog manifests and
examples in this repository. Validate it with `pnpm check:skill` and
regenerate its checksums with
`pnpm exec tsx scripts/check-skill.ts --write-sums` after any edit.

## Vendored skills (do not edit; upgrade through their own flows)

| Skill | Sub-skills | Use for |
| --- | --- | --- |
| [deepworkplan](../skills/deepworkplan/SKILL.md) (7.8.1) | `deepworkplan-create`, `-execute`, `-refine`, `-resume`, `-status`, `-verify`, `-upgrade`, `-onboard`, `-author` | Deep Work Plans, repository conformance, authoring this kit |
| [ai-diff-reviewer](../skills/ai-diff-reviewer/SKILL.md) (3.3.14) | `ai-diff-reviewer-setup`, `-generate-extension`, `-open-pr`, `-apply-review`, `-address-review` | Local diff review with `.review/extension.md` (Flow A only); PR drafting (no push without the developer's go) |

Both are pinned in `skills-lock.json` at the repository root. The agentkit
and Herdr addons enabled in `.dwp/config.json` are machine installs, not
vendored skills in this folder.

## Commands (`.agents/commands/`)

`commit`, `code-review`, `pr`, `dwp-create`, `dwp-execute`, `dwp-refine`,
`dwp-resume`, `dwp-status`, `dwp-verify`, `dwp-upgrade`, `skill-create`,
`agent-create`. What each routes to: [COMMANDS_REFERENCE.md](COMMANDS_REFERENCE.md).
