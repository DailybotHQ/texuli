---
name: texuli
description: Build accessible, themed interfaces with Texuli (Svelte 5 components, themes and design systems, charts, data, media, documents, forms, canvas, sheets, decks, workflows) and agent-written blueprints, by routing requests to local sub-skills; covers the Texuli MCP server, installation, upgrades and contributions.
version: "0.3.24"
documentation_url: https://texuli.com/guides/
user-invocable: true
allowed-tools: Bash, Read, Grep, Glob
metadata: {"openclaw":{"emoji":"▣","homepage":"https://texuli.com/guides/","requires":{"anyBins":["bash","git"]}}}
---

# Texuli — interface skill

**Texuli — Small pieces. Infinite possibilities.** An open-source (MIT)
Svelte 5 component library, built from scratch, owned end to end and native
for agents. **Texels** (framework-free behavior and policy in
`@texuli/core`) compose into owned headless **primitives**
(`@texuli/primitives`); with the **token** engine (`@texuli/tokens`: 200+
themes, and design systems, one JSON document per brand) they become styled
**Texuli components** and layouts (`texuli`). **Domain packages** build on
them: charts, data views and dashboards, media, chat, content blocks, the
rich text editor, block documents and pages, schema-driven forms, the
infinite canvas, spreadsheets, decks and slides, drag and drop, and
workflow editors. The **agent catalog** (`@texuli/catalog`) lets an agent
write an interface as data, a **blueprint** on the `@texuli/spec` contract,
which `@texuli/player` paints with no HTML sinks (a Kotlin Multiplatform
twin in the repository's `native/` validates the same contract). The same
operations are MCP tools (local `npx -y @texuli/mcp`, remote
`https://texuli.com/mcp`) and `texuli <group> <verb>` commands.

Use this skill to build accessible, token-themed UI with those pieces, and
to write, validate and paint blueprints (whole stateful screens in spec
JSON; the current spec is `0.12.0`). This file is the **router**. Detailed
procedures live in neighboring sub-skills and in [`router/`](router/). Read
the matching guide before starting its workflow. Everything needed to route
ships in this pack — **no network** is required for ordinary routing.

## When to use Texuli

| Situation | Use Texuli when… |
| --- | --- |
| New UI in a Texuli or Protoyard workspace | The app needs accessible components, themes, or media chrome on the Texuli stack |
| Design-system work | Tokens, forced-colors, theme generation or a brand's design-system document are in scope |
| Agent-driven UI | The developer wants a local skill pack, or the Texuli MCP tools, instead of ad-hoc prompts |
| Agent-written blueprints | A tree or envelope must be validated, edited, painted or handed to an owner, never activated by the agent |

Do **not** treat this skill as a license to install software, change global
agent config, or publish packages without explicit consent (see
[`TRUST.md`](TRUST.md)).

## First run

1. If the developer wants this skill installed or updated, follow
   [`setup.sh`](setup.sh) and the host map in [`router/hosts.md`](router/hosts.md).
   Installing the skill does **not** install Texuli packages or a CLI.
2. Confirm the workspace has Texuli (workspace packages `texuli`,
   `@texuli/core`, `@texuli/tokens`, …) before promising package imports.
   All 26 published packages are on npm in the 0.15 line, every one at
   `0.15.0`, published by CI
   through npm trusted publishing with provenance under the `latest`
   dist-tag (`next` is no longer maintained and stays on `0.12.1`). They
   are pre-1.0: a new minor may break, and 1.0.0 will be the first stable
   release. Install them plainly (`pnpm add texuli`) and pin `^0.15.0`; the
   workspace packages stay `private: true`. `@texuli/drag`,
   `@texuli/workflows`, `@texuli/deck`, `@texuli/slides`,
   `@texuli/editor`, `@texuli/document`, `@texuli/pages`,
   `@texuli/forms`, `@texuli/canvas`, `@texuli/sheets` and `@texuli/mcp`
   are in development, though on npm at the same version. `0.12.0` moved
   the `@texuli/pages` core entries off the deck model: `PageEditorCore`,
   `CollabEditorCore` and `createDocumentPlayerHostCore` need
   `validateDeck` for inline decks. `0.13.0` (spec 0.11.0, one label
   dictionary in `texuli/i18n`) and `0.14.0` (spec 0.12.0: timeline
   groups, `aa-non-text`) break no API, but compiled design-system
   hashes change. Which entry arrived in which release
   (marked "new in `0.x.0`") is in [`router/packages.md`](router/packages.md);
   an app pinned to an older line must not use a newer entry. The breaking
   changes of each release, with their one-line migrations, are in
   [`upgrade/SKILL.md`](upgrade/SKILL.md).
3. Route by intent using the table below and
   [`router/routes.md`](router/routes.md).

## Route by intent

| Developer intent | Read |
| --- | --- |
| Install or verify this skill pack on a host | [`setup.sh`](setup.sh), [`router/hosts.md`](router/hosts.md) |
| Upgrade this skill, or move an app across Texuli releases (breaking changes per release) | [`upgrade/SKILL.md`](upgrade/SKILL.md) |
| Connect an agent host to the Texuli MCP server (local `npx -y @texuli/mcp` or remote `https://texuli.com/mcp`), or run the same operations with the `texuli` CLI | [`router/hosts.md`](router/hosts.md#mcp) |
| Trust boundary, consent, no network | [`TRUST.md`](TRUST.md) |
| Full routing table and sub-skill map | [`router/routes.md`](router/routes.md) |
| Which package or subpath exists, and its layer | [`router/packages.md`](router/packages.md) |
| Build or fix a component / layout / shell / screen | [`build-ui/SKILL.md`](build-ui/SKILL.md) |
| Charts, data views (grid, tree, board, calendar, timeline, map, files), dashboards, chat, content blocks | [`build-ui/SKILL.md`](build-ui/SKILL.md) (recipes), [`build-ui/references/imports.md`](build-ui/references/imports.md) |
| Block documents and pages (editor, reader, paged view, DOCX and PDF export, collaboration), schema-driven forms, the infinite canvas, spreadsheets | [`build-ui/SKILL.md`](build-ui/SKILL.md) (recipes); as agent data, [`blueprints/SKILL.md`](blueprints/SKILL.md) stages **I** and **J** |
| A deck from JSON or Markdown: layouts, validation, `DeckStage`, print and PPTX, the `deck` CLI and MCP tool | [`build-ui/references/decks.md`](build-ui/references/decks.md) |
| Drag and drop: sortable lists, groups, boards, trees, a canvas, a workflow editor | [`build-ui/SKILL.md`](build-ui/SKILL.md) (recipes) |
| Themes, palettes, forced-colors, AA contrast, theme CLI/MCP | [`themes/SKILL.md`](themes/SKILL.md) |
| A whole brand as one design-system document: author, import (DTCG, Tokens Studio, a logo), validate and repair by code, apply to a blueprint, export (new in `0.10.0`) | [`design-systems/SKILL.md`](design-systems/SKILL.md) |
| Images, video, captions, compositions, export, generator slot | [`media/SKILL.md`](media/SKILL.md) |
| Validate, wrap, edit or paint an agent blueprint; envelope, player, agent service, spec contract and its Kotlin projection; a whole stateful screen as JSON (state, bindings, actions, `reorder`, `workflow-graph`) | [`blueprints/SKILL.md`](blueprints/SKILL.md) |
| Contribute a primitive or texel | [`contribute/SKILL.md`](contribute/SKILL.md) |
| Install packages, copy (`texuli add`), customize or update components in an app | [`components/SKILL.md`](components/SKILL.md) |
| Check that following this skill yields valid, sink-free, axe-clean trees (golden evals) | [`evals/SKILL.md`](evals/SKILL.md) |

If a named sub-skill folder is not in this pack yet, stay on this router:
follow the repository `AGENTS.md`, package docs under `packages/*/docs/`, and
do not invent install URLs or CLI flags.

## Routing rules

- Keep the developer's requested scope. A one-line fix stays a one-line fix.
- Prefer Texuli public imports (`texuli/button`, `@texuli/core/roving`,
  `@texuli/tokens`) over deep `src/internal` paths.
- Class composition uses Texuli `cx` / `variants` (`texuli/cx`). Never add
  `clsx`, `tailwind-merge`, or `tailwind-variants`.
- WCAG 2.x contrast (AA) in light, dark and `forced-colors` is the contrast
  gate. APCA is out of scope.
- No `{@html}`, `eval`, or `new Function` on untrusted data. Media and link
  URLs go through the URL policy texels.
- **No network** for routing, reading this pack, or local validation. A
  package install, skill install, or docs fetch needs explicit developer
  consent first.

## Commands that always work offline

From a Texuli repository checkout (this pack's parent monorepo):

```bash
# Validate this skill pack (frontmatter, required files, local links, checksums)
pnpm exec tsx scripts/check-skill.ts

# Or the root script (same check)
pnpm check:skill

# Verify checksums only
./skills/texuli/setup.sh --verify

# List supported agent hosts (no install)
./skills/texuli/setup.sh --list-hosts
```

Dry-run an install without writing:

```bash
./skills/texuli/setup.sh --host claude --dry-run
```

## Integrity

`SHA256SUMS` lists every file in this pack. After any edit, regenerate it from
the monorepo:

```bash
pnpm exec tsx scripts/check-skill.ts --write-sums
```

Then `./skills/texuli/setup.sh --verify` must exit 0.

## Local references

- [`TRUST.md`](TRUST.md) — permissions and consent
- [`router/routes.md`](router/routes.md) — intent → guide map
- [`router/hosts.md`](router/hosts.md) — host skill folders
- [`router/packages.md`](router/packages.md) — packages, layers and entries
- Product docs (network): <https://texuli.com/guides/>
