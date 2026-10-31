# @texuli/mcp

The local [Model Context Protocol](https://modelcontextprotocol.io) server
for [Texuli](https://texuli.com), an MIT-licensed Svelte 5 component library
by Dailybot, Inc. (*Small pieces. Infinite possibilities.*). An agent
connected to it can search the component catalog, read manifests and worked
examples, validate blueprint drafts, search and preview themes with their
WCAG AA report, and run the deck and document commands.

> **Status: in development (pre-1.0).** `@texuli/mcp` is published on npm
> as `0.11.1`, with provenance (first published as `0.9.0`). Under 0.x a new minor
> (`0.12.0`) may contain breaking changes, so pin the exact version or use
> `^0.11.0`, which accepts only 0.11.x
> (see [RELEASE](https://github.com/DailybotHQ/texuli/blob/main/docs/RELEASE.md)).

## Connect your agent

Every host runs the same command: `npx -y @texuli/mcp`. It speaks MCP over
stdio and runs on Node.js (tested on Node 24, the version this repository
develops on); nothing is installed globally.

**Claude Code**

```bash
claude mcp add texuli -- npx -y @texuli/mcp
```

**Cursor** (`.cursor/mcp.json` in the project, or `~/.cursor/mcp.json`)

```json
{
  "mcpServers": {
    "texuli": { "command": "npx", "args": ["-y", "@texuli/mcp"] }
  }
}
```

**VS Code** (`.vscode/mcp.json` in the workspace)

```json
{
  "servers": {
    "texuli": { "type": "stdio", "command": "npx", "args": ["-y", "@texuli/mcp"] }
  }
}
```

**Windsurf** (`~/.codeium/windsurf/mcp_config.json`)

```json
{
  "mcpServers": {
    "texuli": { "command": "npx", "args": ["-y", "@texuli/mcp"] }
  }
}
```

**Codex** (`~/.codex/config.toml`)

```toml
[mcp_servers.texuli]
command = "npx"
args = ["-y", "@texuli/mcp"]
```

**Claude Desktop and other stdio hosts:** the same `mcpServers` entry as
Cursor (Claude Desktop reads it from `claude_desktop_config.json`), or, in
any host that asks for a command line, `npx -y @texuli/mcp`. On Windows,
hosts that cannot start `npx` directly take `"command": "cmd"` with
`"args": ["/c", "npx", "-y", "@texuli/mcp"]`.

**Already using `@texuli/tools`?** `npx texuli mcp` runs the same server
from that package; no second install is needed.

**Remote:** a read-only remote endpoint at `https://texuli.com/mcp`
(stateless Streamable HTTP, the `edge` operations plus the `site` tools
that read texuli.com; no key), served by `functions/mcp.ts` with the site.
Hosts that take a URL connect to it directly. After each deploy, the CI job
`mcp-remote-smoke` checks that its `tools/list` matches the registry. The
server card at `https://texuli.com/.well-known/mcp/server-card.json` lists
both transports and every tool.

## What it serves

- **Tools:** every operation of the Texuli operations registry whose runtime
  is `edge` or `node`, as `group.verb` tools (`catalog.search`,
  `component.get`, `example.search`, `blueprint.validate`, `theme.search`,
  `theme.preview`, `deck.run`, `document.export` …), each with an input and
  output JSON Schema and annotations. Failures are `isError` results with a
  stable code.
- **Resources:** `texuli://catalog`, `texuli://llms/full`,
  `texuli://component/{id}`, `texuli://docs/{slug}`, `texuli://theme/{id}`
  and `texuli://schema/{name}`.
- **Prompts:** `build-ui`, `theme-blueprint` and `convert-deck`, plus
  completions for their arguments.

**Protocol revisions.** `initialize` negotiates `2025-11-25` (preferred),
`2025-06-18`, `2025-03-26` and `2024-11-05`. Since 0.10.0 the server also answers MCP revision `2026-07-28` in part:
a request that carries
`params._meta["io.modelcontextprotocol/protocolVersion"]: "2026-07-28"`
needs no `initialize` and may call `server/discover`, `tools/*`,
`prompts/*`, `resources/*` and `completion/complete`; an unknown `_meta`
revision is `-32022` with `error.data.supported`. Requests without that
`_meta` version behave as before (a request before initialization is
`-32600`). The remote `https://texuli.com/mcp` answers the same messages
the same way.

The protocol details (versions, the parts of `2026-07-28` that are
implemented, lifecycle, limits, error codes) are in
[`@texuli/tools` MCP](../tools/docs/mcp.md).

## Safety

- **No network.** No operation fetches anything or needs a secret.
- **No writes today.** Every current operation is read-only and returns its
  output (a PDF comes back as base64, not as a file). Operations that write
  files later (such as saving a design system) take an explicit path that
  must resolve inside the working directory the host starts the server in;
  `..` traversal and symlinks are refused.
- **Bounded input.** A stdio message over 2 MiB is refused before parsing,
  and every operation has its own input, item and time limits.
- **stdout is the protocol.** Logs and errors go to stderr only.

## Command line

```text
texuli-mcp            serve MCP over stdio until stdin closes
texuli-mcp --help     usage
texuli-mcp --version  the package version (equal to @texuli/tools)
```

## Programmatic use

```ts
import { startTexuliMcp, TEXULI_MCP_VERSION } from '@texuli/mcp';

await startTexuliMcp(); // stdin and stdout; or { input, output } streams
```

To embed the protocol in another transport, use `createMcpHandler` from
`@texuli/tools/mcp` instead. Details: [docs/server.md](docs/server.md).

## From a checkout

To run the server from a Texuli checkout (for example, to try a change
before it is released):

```bash
pnpm exec tsx packages/mcp/src/bin.ts --help
```

and point a host at `pnpm exec tsx packages/mcp/src/bin.ts` with the
checkout as its working directory.

## Versioning

`@texuli/mcp` depends on exactly one `@texuli/tools` version, the same as
its own, and both publish in the same release wave, so the server a host
starts always reports the version it was installed at.

## Contributing

Texuli is built in the open at
[github.com/DailybotHQ/texuli](https://github.com/DailybotHQ/texuli). Report
bugs at [github.com/DailybotHQ/texuli/issues](https://github.com/DailybotHQ/texuli/issues).

## License

MIT © Dailybot, Inc. Powered by [Dailybot](https://www.dailybot.com?utm_source=dailybotopensource&utm_medium=texuli-mcp).
