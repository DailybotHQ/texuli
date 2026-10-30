# The server entry and the bin

**Package:** `@texuli/mcp` · **Subpath:** `.` · **Bin:** `texuli-mcp` ·
**Decision:** [ADR-019](../../../docs/DECISIONS.md#adr-019-the-texulimcp-package-and-its-binary)

> **Status: in development (pre-1.0).** On npm since `0.9.0`, its first release.

`@texuli/mcp` is a thin package: the protocol handler, the stdio transport,
the operations registry, the resources and the prompts live in
`@texuli/tools` ([mcp.md](../../tools/docs/mcp.md), [ops.md](../../tools/docs/ops.md)).
This package holds the bin and three exports.

| Export | What it does |
| --- | --- |
| `startTexuliMcp(options?)` | Serves MCP over newline-delimited JSON-RPC on `options.input` and `options.output` (default stdin and stdout) with every `edge` and `node` operation; resolves when the input ends |
| `runTexuliMcpCli(argv?, options?)` | The `texuli-mcp` command: `--help` and `--version` print and return `{ ok: true, served: false }`; no argument serves stdio; any other argument is refused on stderr with exit code 1 |
| `TEXULI_MCP_VERSION` | The package version, read from its manifest; always equal to the `@texuli/tools` version |

`texuli-mcp` and `texuli mcp` (the `@texuli/tools` CLI) run the same
`runMcpCli` from `@texuli/tools/mcp`, so both doors serve the same tools,
resources and prompts and keep the initialization gate the specification
requires (only `initialize` and `ping` answer before
`notifications/initialized`).

## Lifecycle

- The server reads stdin line by line and writes one JSON line per
  response on stdout; notifications get no response.
- Usage, errors and any log go to stderr, never to stdout.
- When stdin closes (the host quits), pending requests finish and the
  process exits with code 0.

## Local writes

No operation writes files today. Operations that will (`ds.save`, file
outputs of deck and document operations) must call the local write policy
in `@texuli/tools` (`src/internal/local-write.ts`): an explicit path that
resolves inside the working directory, never the directory itself, with
`..` escapes, NUL bytes and symlinked components refused, and a new file
unless overwriting is asked for.

## Tests

- `packages/mcp/tests/mcp.test.ts`: the exports, the flags and a stdio
  session through `startTexuliMcp`.
- `packages/tools/tests/mcp-cli.test.ts`: `runMcpCli` and `texuli mcp`.
- `packages/tools/tests/local-write.test.ts`: the write policy.
- `tests/consumers/mcp.spec.ts`: installs the packed tarballs into a clean
  app, spawns `node_modules/.bin/texuli-mcp`, completes the handshake,
  `tools/list` and a `catalog.search` call, and checks the clean exit on
  stdin close.
