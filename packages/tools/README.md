# @texuli/tools

Agent and developer tooling for [Texuli](https://texuli.com), an
MIT-licensed Svelte 5 component library by Dailybot, Inc. (*Small pieces.
Infinite possibilities.*). It includes command-line tools that wire Texuli
themes into a project and copy component source into your app. It also
generates `llms.txt` agent docs from the component catalog, converts to and
from A2UI messages, and provides light-DOM custom elements that render
catalog trees in any host, Svelte or not. A golden set of interface tasks
with an offline scorer measures how well an agent builds with the catalog.

> **Status: 0.x release.** Texuli is in development. The packages are
> published to npm as `0.10.1`, a pre-1.0 release (1.0.0 will be the first
> stable release). Under 0.x, a new minor (`0.11.0`) may contain breaking
> changes, so pin the exact version or use `^0.10.0`, which accepts only 0.10.x.

## Install

```bash
npm install @texuli/tools svelte
```

Svelte 5 (`^5.57.2`) is a peer dependency. The package installs four
command-line tools: `texuli-init`, `texuli-add`, `texuli-update` and
`texuli-llms`. They work on local files only and make no network requests.

Run them with `npx` (or from a package script):

```bash
npx texuli-init theme list
```

## Quick start

Wire Texuli's tokens and a theme into a Vite, Astro or SvelteKit project
(the framework is detected from `package.json`):

```bash
npx texuli-init init --theme ocean --dry-run
npx texuli-init theme preview ocean --mode dark
```

Render agent output in any page with the custom elements:

```ts
import { defineTexuliElements } from '@texuli/tools/elements';

defineTexuliElements(); // <tx-catalog>, <tx-blocks-text>, <tx-charts-bar>, …
```

```html
<tx-catalog>
  <script type="application/json">
    [{ "id": "blocks-text", "props": { "block": { "type": "heading", "level": 2, "text": "Quarterly notes" } } }]
  </script>
</tx-catalog>
```

## What's inside

**Command-line tools**

| Command | Subpath | What it does |
| --- | --- | --- |
| `texuli-init` | `@texuli/tools/cli-init` | `init` wires tokens, a theme and a no-flash bootstrap into a project; `theme list`, `theme preview` and `theme apply` work with the theme library |
| `texuli-add` | `@texuli/tools/cli-add` | Copies styled component source into your app with a provenance header, from a Texuli source checkout (`--source-root`) |
| `texuli-update` | `@texuli/tools/cli-update` | `diff` and `update` merge a copied component with new upstream source (three-way merge from the provenance headers) |
| `texuli-llms` | `@texuli/tools/llms` | Generates `llms.txt`, `llms-full.txt` and per-component Markdown from catalog manifests |

**Libraries**

| Subpath | What it does |
| --- | --- |
| `@texuli/tools/elements` | Light-DOM custom elements that render catalog trees with the real content components |
| `@texuli/tools/a2ui` | Experimental: converts catalog trees to and from A2UI v0.9 server-to-client messages, on plain data |
| `@texuli/tools/golden` | Thirty interface tasks for agents, each with a reference tree, and an offline, report-only scorer |
| `@texuli/tools/llms` | `buildLlmsBundle` and `writeLlmsBundle`: the agent docs bundle as a library |

The root entry, `@texuli/tools`, re-exports the A2UI, copy-in, update and
llms helpers.

`npx texuli-llms --out <dir>` writes `llms.txt`, `llms-full.txt` and
one Markdown page per catalog component from the published manifests.

New in `0.9.0`: the read-only MCP server, exported as `@texuli/tools/mcp`
and started with `texuli mcp` (stdio). MCP hosts install it with
`npx -y @texuli/mcp`, the thin `@texuli/mcp` package first published in
`0.9.0`; host setup is in its
[README](https://github.com/DailybotHQ/texuli/blob/main/packages/mcp/README.md).
The remote endpoint `https://texuli.com/mcp` (`functions/mcp.ts`, the
`edge` and `site` operations) is live with texuli.com. The server speaks MCP `2025-11-25` (negotiating the
three earlier versions) through a transport-independent handler: tools with
output schemas and structured results, resources (the catalog, component
manifests and pages, themes, the deck and document schemas), prompts
(`build-ui`, `theme-blueprint`, `convert-deck`) and completions; see
[mcp.md](https://github.com/DailybotHQ/texuli/blob/main/packages/tools/docs/mcp.md).
Its tools come from an operations registry (`./ops`, new in `0.9.0`): one
declaration per
operation (`catalog.search`, `component.get`, `blueprint.validate`,
`theme.preview`, `deck.run` …)
with JSON Schema input and output, limits and examples; see
[ops.md](https://github.com/DailybotHQ/texuli/blob/main/packages/tools/docs/ops.md).
From `0.9.0` the `texuli` bin runs each one as `texuli <group> <verb>`
(JSON from stdin, `--json` or `--file`; `--out` writes a new file inside the
working directory), with `texuli help` written from the registry; the 0.8
commands (`texuli deck …`, `texuli document …`, `texuli mcp`) stay, and
`texuli init`, `theme`, `add`, `diff` and `update` now route to their own
bins' commands.

**Deck commands (in development, new in `0.4.0`).** `@texuli/tools` adds
a `@texuli/tools/deck` subpath and two bins, `texuli` (its `deck`
command) and `texuli-deck`, with seven commands on the `@texuli/deck` v2
model: `capabilities`, `schema`, `layouts`, `lint`, `inspect`,
`from-markdown` and `to-markdown`. The local MCP server has the same
commands as a read-only `deck` tool. None of this is in `0.3.0`; it ships
in `0.4.0` with the first release of `@texuli/deck`; see
[deck.md](https://github.com/DailybotHQ/texuli/blob/main/packages/tools/docs/deck.md).

**Document commands (in development, new in `0.7.0`).**
A `@texuli/tools/document` subpath and the `document`
command of the `texuli` bin, with ten commands on `@texuli/document`
(spec 0.7.0): `capabilities`, `schema`, `validate`, `inspect`, `patch`
(bounded RFC 6902), `from-markdown`, `to-markdown`, `to-blueprint`,
`to-docx` and `to-pdf`. The local MCP server has the same commands as a
read-only `document` tool; see
[document.md](https://github.com/DailybotHQ/texuli/blob/main/packages/tools/docs/document.md).

**Design-system conformance (new in `0.10.0`).** `texuli ds check <file>` validates and compiles a design-system
document and reports the spec's codes, the guarantees and the contrast
report (`--json`); `--render` also paints the agent-emittable catalog
components under it in headless chromium (axe, painted contrast, literal
colors). The `@texuli/tools/ds-check` subpath runs the same checks in your
own tests; see
[ds-check.md](https://github.com/DailybotHQ/texuli/blob/main/packages/tools/docs/ds-check.md).
The `ds.*` operations (validate, compile to JSON, CSS, Tailwind, DTCG or
Tokens Studio, contrast, suggest, import, diff, preview, and `ds.save` on
local doors), `blueprint.theme` and `texuli ds init | validate | compile |
export | preview | diff | import` ship in the same release; see
[ds.md](https://github.com/DailybotHQ/texuli/blob/main/packages/tools/docs/ds.md).

**Email and print (new in `0.8.0`).** `@texuli/tools/email`
renders a validated blueprint to email-safe HTML and a plain-text part
(tables, typed inline styles resolved to sRGB, escaped text only, links and
images through the untrusted URL policy); see
[email.md](https://github.com/DailybotHQ/texuli/blob/main/packages/tools/docs/email.md).
`@texuli/tools/print` maps a validated blueprint to a `@texuli/document`
document and writes a headless PDF with the owned writer; see
[print.md](https://github.com/DailybotHQ/texuli/blob/main/packages/tools/docs/print.md).

## Key guarantees

- **Local only.** The CLIs read and write local files and never use the
  network. `--dry-run` plans without writing, and `--json` prints
  machine-readable results.
- **Never overwrites silently.** `texuli-init` replaces a stylesheet or
  config it did not generate only with `--force`, and never follows
  symlinks; `texuli-update` refuses conflicts by default.
- **Untrusted catalog trees.** The custom elements check every tree against
  the catalog, at the `untrusted` tier by default, before it renders. The
  A2UI adapter validates message shapes and works on plain data, with no
  DOM and no network.
- **Styled source only.** `texuli-add` copies styled components and never
  copies the headless primitives package.

## Documentation

- Website: [texuli.com](https://texuli.com), the
  [agents overview](https://texuli.com/agents-page/) and the site's
  [llms.txt](https://texuli.com/llms.txt)
- `texuli init` and themes: [cli-init.md](https://github.com/DailybotHQ/texuli/blob/main/packages/tools/docs/cli-init.md)
- `texuli add`: [cli-add.md](https://github.com/DailybotHQ/texuli/blob/main/packages/tools/docs/cli-add.md) · `texuli diff` and `texuli update`: [cli-update.md](https://github.com/DailybotHQ/texuli/blob/main/packages/tools/docs/cli-update.md)
- Agent docs bundle: [llms.md](https://github.com/DailybotHQ/texuli/blob/main/packages/tools/docs/llms.md)
- Custom elements: [elements.md](https://github.com/DailybotHQ/texuli/blob/main/packages/tools/docs/elements.md)
- A2UI adapter: [a2ui.md](https://github.com/DailybotHQ/texuli/blob/main/packages/tools/docs/a2ui.md)
- Golden set and scorer: [golden.md](https://github.com/DailybotHQ/texuli/blob/main/packages/tools/docs/golden.md)
- Deck commands, the `texuli deck` CLI and the `deck` MCP tool (new in `0.4.0`): [deck.md](https://github.com/DailybotHQ/texuli/blob/main/packages/tools/docs/deck.md)
- Document commands, the `texuli document` CLI and the `document` MCP tool (new in `0.7.0`): [document.md](https://github.com/DailybotHQ/texuli/blob/main/packages/tools/docs/document.md)
- The operations registry behind the MCP tools and the CLI (in development, not released): [ops.md](https://github.com/DailybotHQ/texuli/blob/main/packages/tools/docs/ops.md)
- The MCP protocol layer: tools, resources, prompts and completions (in development, not released): [mcp.md](https://github.com/DailybotHQ/texuli/blob/main/packages/tools/docs/mcp.md)
- Design-system conformance, `texuli ds check` and `@texuli/tools/ds-check` (from `0.10.0`): [ds-check.md](https://github.com/DailybotHQ/texuli/blob/main/packages/tools/docs/ds-check.md)
- Design-system operations, `blueprint.theme` and `texuli ds` (from `0.10.0`): [ds.md](https://github.com/DailybotHQ/texuli/blob/main/packages/tools/docs/ds.md)
- Email-safe HTML from blueprints (new in `0.8.0`): [email.md](https://github.com/DailybotHQ/texuli/blob/main/packages/tools/docs/email.md)
- Print and headless PDF of blueprints (new in `0.8.0`): [print.md](https://github.com/DailybotHQ/texuli/blob/main/packages/tools/docs/print.md)

## Related packages

- [`@texuli/catalog`](https://www.npmjs.com/package/@texuli/catalog): the catalog these tools read and validate against.
- [`@texuli/tokens`](https://www.npmjs.com/package/@texuli/tokens): the theme engine behind `texuli-init`.
- [`@texuli/player`](https://www.npmjs.com/package/@texuli/player): paints validated blueprints in Svelte.

## Contributing

Source, issues and contribution guidelines live at
[github.com/DailybotHQ/texuli](https://github.com/DailybotHQ/texuli). Report
bugs at [github.com/DailybotHQ/texuli/issues](https://github.com/DailybotHQ/texuli/issues).

## License

MIT © Dailybot, Inc. Powered by [Dailybot](https://www.dailybot.com?utm_source=dailybotopensource&utm_medium=texuli-tools).
