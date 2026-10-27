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
> published to npm as `0.2.0`, a pre-1.0 release (1.0.0 will be the first
> stable release). Under 0.x, a new minor (`0.3.0`) may contain breaking
> changes, so pin the exact version or use `^0.2.0`, which accepts only 0.2.x.

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

Not shipped in this package: the read-only MCP server over the catalog and
themes exists in the repository source, but has no export and no published
command yet.

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

## Related packages

- [`@texuli/catalog`](https://www.npmjs.com/package/@texuli/catalog): the catalog these tools read and validate against.
- [`@texuli/tokens`](https://www.npmjs.com/package/@texuli/tokens): the theme engine behind `texuli-init`.
- [`@texuli/player`](https://www.npmjs.com/package/@texuli/player): paints validated blueprints in Svelte.

## Contributing

Source, issues and contribution guidelines live at
[github.com/DailybotHQ/texuli](https://github.com/DailybotHQ/texuli). Report
bugs at [github.com/DailybotHQ/texuli/issues](https://github.com/DailybotHQ/texuli/issues).

## License

MIT © Dailybot, Inc.
