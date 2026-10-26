# @texuli/tools

**Layer L7: tools.** Agent and developer tooling over the library: the
copy-in CLI, the agent docs bundle, the A2UI adapter, custom elements, the
golden set and the read-only MCP server. Published to npm as `0.1.0-next.1` under the `next`
dist-tag (by CI, with provenance); no stable release (`latest` is reserved
for 1.0.0), so install it with `@next`. The workspace package stays
`"private": true`. The bins below are
documented for use inside this repository.

## What exists today

Every area has source in `src/` and a unit test in `tests/`. All areas
except the MCP server also have a doc in [`docs/`](docs/) and an exported
subpath in `package.json`.

| Area | Source | Subpath | Bin | What it does |
| --- | --- | --- | --- | --- |
| Copy-in CLI | `src/cli-add/` | `@texuli/tools/cli-add` | `texuli-add` | Copies styled component source into a consumer app with a provenance header. Never copies `@texuli/primitives`; local paths only. [Docs](docs/cli-add.md) |
| Init and themes | `src/cli-init/` | `@texuli/tools/cli-init` | `texuli-init` | Wires tokens and CSS into a Vite, Astro or SvelteKit project, then lists, previews and applies themes from the theme library (210 themes). Local files only. [Docs](docs/cli-init.md) |
| Update | `src/cli-update/` | `@texuli/tools/cli-update` | `texuli-update` | Updates a component copied with `texuli add` to new source by three-way merge: base from the provenance headers, the consumer's edits, the new upstream. [Docs](docs/cli-update.md) |
| Agent docs bundle | `src/llms/` | `@texuli/tools/llms` | `texuli-llms` | Generates the llms.txt bundle and agent-facing docs from catalog manifests. [Docs](docs/llms.md) |
| A2UI adapter (experimental) | `src/a2ui/` | `@texuli/tools/a2ui` | — | Converts between catalog trees and A2UI v0.9 server-to-client messages, on plain data only. [Docs](docs/a2ui.md) |
| Custom elements | `src/elements/` | `@texuli/tools/elements` | — | Light-DOM custom elements that render catalog trees with the real content components, for hosts that do not use Svelte. [Docs](docs/elements.md) |
| Golden set | `src/golden/` | `@texuli/tools/golden` | CLI source only: `src/golden/cli.ts`, not a registered bin | Thirty pre-registered interface tasks for agents, each with a reference tree, plus an offline scorer. [Docs](docs/golden.md) |
| MCP server | `src/mcp/` | — | — | The read-only local stdio MCP server over the catalog and themes (`catalog`, `component`, `validate`, `example`, `theme` tools). Source and tests only: no export, no published binary. |

The root entry (`@texuli/tools`) re-exports the A2UI, copy-in CLI, update
and llms helpers.

## Status

Implemented and gated in this repository: unit tests per area, including
`tests/mcp.test.ts`. Nothing is delivered outside it yet — no npm release
and no published MCP binary
([ARCHITECTURE](../../docs/ARCHITECTURE.md) tracks the delivery plan).
