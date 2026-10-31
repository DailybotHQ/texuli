# MCP protocol layer

**Package:** `@texuli/tools` · **Subpath:** `@texuli/tools/mcp` (`src/mcp/`) ·
**Decisions:** [ADR-017](../../../docs/DECISIONS.md#adr-017-one-operations-registry-texulitoolsops-for-every-agent-surface),
[ADR-018](../../../docs/DECISIONS.md#adr-018-the-remote-mcp-on-pages-functions),
[ADR-019](../../../docs/DECISIONS.md#adr-019-the-texulimcp-package-and-its-binary)

> **Status: released in `0.9.0` (pre-1.0).** The protocol layer, the
> `@texuli/tools/mcp` export, `texuli mcp` and the `@texuli/mcp` package
> are new in `0.9.0`, and the remote endpoint is live at
> `https://texuli.com/mcp` (see [The remote door](#the-remote-door)). The
> seven 0.8 tool names, deprecated aliases in `0.9.0`, are removed on the
> `release/0.10.0` branch (not on npm yet): a call names the operation to
> use instead ([ops.md](ops.md#removed-08-tool-names)).

## The local door

Two commands start the same stdio server (`runMcpCli`): every `edge` and
`node` operation, the resources, the prompts and the completions below.

| Command | Package | For |
| --- | --- | --- |
| `npx -y @texuli/mcp` (bin `texuli-mcp`) | `@texuli/mcp` (L9) | MCP hosts: the one-word install they document |
| `npx texuli mcp` | `@texuli/tools` | Projects that already have the tools CLI |

Host setup (Claude Code, Cursor, VS Code, Windsurf, Codex, generic stdio
hosts) is in the [`@texuli/mcp` README](../../mcp/README.md). From a
checkout, `pnpm exec tsx packages/mcp/src/bin.ts` runs the workspace
source.

- **Flags:** `--help` and `--version` print to stdout and exit; any other
  argument is refused on stderr with exit code 1, without starting the
  server. With no argument the server reads stdin until it closes, then
  exits with code 0.
- **stdout carries only JSON-RPC**; usage errors go to stderr.
- **Local writes:** `ds.save` is the only operation that writes (from
  `0.10.0`, in development). It writes through the local writer the door
  passes (`files: localFiles()` in `runMcpStdio` and the CLI; the remote
  door passes none, and the edge handler never imports `node:fs`), which applies the local write policy in
  `src/internal/local-write.ts` (`resolveLocalWritePath`,
  `writeLocalFile`): an explicit path that
  resolves inside the working directory and is not the directory itself;
  absolute paths only when they already point inside it; `..` escapes, NUL
  bytes, over-long paths and symlinked components (the target included)
  refused with a stable code (`path-required`, `path-invalid`,
  `outside-working-directory`, `not-a-file`, `symlink`); and a new file
  (`exists` otherwise) unless `overwrite` is set. The `texuli document --out`
  CLI flag keeps its own rule (a new file at the path the user typed).

`createMcpHandler` turns the [operations registry](ops.md) into an MCP
server. It is transport-independent and edge-safe (no Node built-ins): one
JSON-RPC message in, one response out, or nothing for a notification. The
stdio transport (`runMcpStdio`, `src/mcp/stdio.ts`) uses it, and the remote
HTTP endpoint ([The remote door](#the-remote-door)) uses the same handler in
stateless mode.

```ts
import { createMcpHandler } from '@texuli/tools/mcp';

const local = createMcpHandler({ mode: 'stateful' }); // stdio: edge + node operations
const remote = createMcpHandler({ mode: 'stateless', runtimes: ['edge', 'site'] }); // HTTP
const response = await remote(
  { jsonrpc: '2.0', id: 1, method: 'tools/list' },
  // the MCP-Protocol-Version header, and the built site the site.* tools read
  { protocolVersion: '2025-11-25', site: { assets: env.ASSETS } }
);
```

## Options

| Option | Default | Meaning |
| --- | --- | --- |
| `registry` | every Texuli operation | The operations served as tools |
| `mode` | `stateful` | `stateful` keeps the initialization gate (stdio); `stateless` never requires it (HTTP) |
| `runtimes` | `['edge', 'node']` | The runtime classes served; the remote door passes `['edge', 'site']` |
| `capabilities` | all on | `{ resources, prompts, completions }`: `false` switches one off |
| `resources` | the Texuli resources | Resource providers; an empty list advertises no resources |
| `prompts` | the Texuli prompts | Prompts; an empty list advertises no prompts |
| `pageSize` | 100 | Items per page of every list method |
| `files` | none | The local writer `ds.save` uses (`localFiles()` from the stdio server); without it `ds.save` answers `runtime-unavailable` |

`createTexuliMcpServer(registry?)`, the 0.8 entry point, is a deprecated
alias of `createMcpHandler({ registry, mode: 'stateful' })`.

## Protocol versions

The handler prefers `2025-11-25` and negotiates `2025-06-18`, `2025-03-26`
and `2024-11-05`. `initialize` answers the client's version when it is one of
these, and `2025-11-25` otherwise. Each result is shaped to the version:
`title`, `outputSchema` and `structuredContent` appear from `2025-06-18`,
tool `annotations` and the `completions` capability from `2025-03-26`. A
stateful handler uses the negotiated version. A stateless handler uses the
version its caller passes in the request context (the HTTP
`MCP-Protocol-Version` header); without one it uses `2025-11-25`, and an
unsupported one is refused with `-32600`.

## Lifecycle

- **Stateful (stdio):** only `initialize` and `ping` answer before
  `notifications/initialized`; anything else gets `-32600` with a message
  that says to initialize first.
- **Stateless (HTTP):** every method works without a handshake;
  `initialize` still answers, and nothing is kept between requests.

## Capabilities

The handler advertises only what it serves:

| Capability | Advertised when |
| --- | --- |
| `tools: { listChanged: false }` | always |
| `resources: { subscribe: false, listChanged: false }` | at least one resource provider, not switched off |
| `prompts: { listChanged: false }` | at least one prompt, not switched off |
| `completions: {}` | a template or prompt argument can be completed, not switched off, protocol `2025-03-26` or later |

A method of a capability that is not advertised answers `-32601`, as do
`logging/setLevel`, `resources/subscribe`, `resources/unsubscribe` and
sampling, which are never offered.

## Tools

`tools/list` is generated from the registry: every operation of the served
runtime classes, in registry order, with `name`, `title`, a `description`
(the summary plus its limits), `inputSchema`, `outputSchema` and
`annotations` (`readOnlyHint`, `destructiveHint`, `idempotentHint`,
`openWorldHint`). The deprecated 0.8 names follow, each only when every
operation it can reach is served; they carry no `outputSchema`.

`tools/call` runs `invoke()`. A success returns `structuredContent` (the
operation output) and the same JSON as a text item. A failure is an
`isError` result whose text is `{ "error", "code", "issues"? }` with the
operation's stable code (`invalid-input`, `input-too-large`, `not-found`,
`runtime-unavailable`, `invalid-output`, `timeout`, `operation-failed`,
`unknown-operation`; see [ops.md](ops.md#error-codes)). Calling an operation
the handler knows but does not serve (a `node` operation on an `edge`
handler, or a `site` operation on a local one) gives `runtime-unavailable`.
A name the registry does not know is a `-32602` protocol error. Besides the
protocol version, the per-request context may carry `site: { assets,
origin? }`, the `env.ASSETS`-shaped binding the `site` operations read;
without it they answer `runtime-unavailable`.

The content blocks of the `blocks-*` components are reachable as tools, not
resources: `block.list` lists every block type the validator accepts, and
`block.schema` returns one type's shape, a derived JSON Schema and examples
that validate (see [ops.md](ops.md#block-shapes)). Tools reach every door,
including hosts that show no resources and the CLI (`texuli block list`,
`texuli block schema`). The `build-ui` prompt sends agents there before
they write a `block` prop, and a `block-schema` diagnostic names the shape
expected at the failing path.

## Resources

| URI | Type | Content |
| --- | --- | --- |
| `texuli://catalog` | JSON | The content-addressed catalog: the exact bytes whose SHA-256 is the catalog hash |
| `texuli://llms/full` | Markdown | Every component page in one file, identical to `/llms/llms-full.txt` on the site |
| `texuli://component/{id}` | JSON | One catalog entry (the manifest with group and emit tiers) |
| `texuli://docs/{slug}` | Markdown | One component's agent page, identical to `/llms/components/<id>.md` on the site |
| `texuli://theme/{id}` | JSON, then CSS | The full light and dark theme definition, then its compiled CSS |
| `texuli://design-system/{id}` | JSON | One design-system document: the fictional examples (the spec's `acme`, every section, and `minimal`, the smallest; the guide's brands `quillmark`, `ledgerline` and `tumbletown`), or a library theme as a document (`loadLibraryBase`: `fromTheme` with its generator input as `color.brand`) |
| `texuli://schema/{name}` | JSON | The JSON Schema of `deck` or `document` |

`resources/list` lists the two fixed resources, both schemas, then every
component, every component page, the five example design systems and every
library theme (paginated). The library themes as design-system documents are
not listed, to bound the list: complete `texuli://design-system/{id}` for
every id (the five examples, then the 210 themes) and read one at a time.
`resources/templates/list` returns the five templates. An unknown URI is
`-32002` (resource not found) with `data: { uri }`; a missing, non-string or
over-2,048-character URI is `-32602`.

**What is not served yet, and why:**

- **Package guides** (`packages/<pkg>/docs/*.md`): about 300 files and
  1.5 MB, too large to bundle into an edge handler. `texuli://docs/{slug}`
  is scoped to the component pages, which are computed from the catalog the
  handler already holds. The site's own pages, as Markdown twins, are read
  with the remote-only `site.pages`, `site.read` and `site.search` tools
  ([Site tools](#site-tools-remote-only)).
- **`texuli://schema/blueprint`:** the blueprint JSON Schema lives only in
  `@texuli/spec` (`schemas/blueprint.schema.json`); `@texuli/catalog` exports
  no copy of it, and `@texuli/tools` does not depend on `@texuli/spec` yet
  (adding it needs a lockfile change). An agent checks a blueprint with the
  `blueprint.validate` tool instead.
- **The design-system JSON Schema** (`texuli://schema/design-system`): it
  lives in `@texuli/spec` (`schemas/design-system.schema.json`), which
  `@texuli/tools` does not depend on (the same reason as the blueprint
  schema). `texuli://design-system/acme` shows every section, and
  `ds.validate` checks a document with the spec's codes and paths.

## Prompts

| Prompt | Arguments | The loop |
| --- | --- | --- |
| `build-ui` | `brief` (required), `tier` (`untrusted` or `developer`), `theme` | `catalog.search` → `component.get` (keep by useWhen, drop by dontUseWhen) → `example.search` → compose a catalog tree → `blueprint.validate` until `valid` is true |
| `theme-blueprint` | `brief` (required), `mode` (`light` or `dark`), `theme` | `theme.search` → shortlist → `theme.preview` (keep `aa.pass`) → `theme.get` → how the host applies it |
| `create-design-system` | `brief` (required), `base` (a library theme id), `contrast` (`AA` or `AAA`) | read `texuli://design-system/acme` → `ds.import` or `ds.suggest` → write the sections → `ds.validate` and fix by code until `valid` is true → `ds.contrast` and `ds.preview` → deliver with `ds.compile`, `blueprint.theme` or `ds.save` |
| `convert-deck` | `direction` (required: `from-markdown` or `to-markdown`), `source` | `deck.run` capabilities and layouts → convert → lint until no errors → round-trip check |

The texts follow the skill's loops (`skills/texuli/build-ui`, `themes` and
the deck reference). Each names only real operations and served resources;
the suite checks that (the `create-design-system` text names `ds.save`,
which only the local server lists, and says so). `build-ui` validates through the `blueprint.validate` tool, so
an agent can finish the loop through the protocol alone. `prompts/get` refuses an unknown
prompt, a missing required argument, an unknown argument, a non-string value,
a value outside its enum and a value over its length cap (10,000 characters,
or 2,000,000 for `source`) with `-32602`.

## Completions

`completion/complete` completes the template variables (component ids for
`component/{id}` and `docs/{slug}`, theme ids, design-system ids, schema
names) and the prompt arguments (`theme` and `base` from the library, and the
enums of `tier`, `mode`, `contrast` and `direction`). Matching is a case-insensitive prefix. At most 100 values are
returned, with `total` and `hasMore`. An unknown prompt, template, variable
or reference type is `-32602`; a free-text argument completes to nothing.

## Pagination

`tools/list`, `resources/list`, `resources/templates/list` and
`prompts/list` page by `pageSize`. `nextCursor` is an opaque base64url
string, present only when more items follow. A cursor that was changed, came
from another method or is past the end is refused with `-32602`.

## Error codes

| Code | When |
| --- | --- |
| `-32700` | stdio: a line that is not JSON, or longer than 2 MiB |
| `-32600` | Not a JSON-RPC 2.0 request (bad `jsonrpc`, method or id); a stateful request before initialization; a stateless request with an unsupported protocol version |
| `-32601` | An unknown method, or one whose capability is not advertised |
| `-32602` | Bad params: an unknown tool or prompt, a bad cursor, a bad URI, bad prompt arguments, a bad completion reference |
| `-32603` | A resource provider threw; the message is `Internal error` and never carries the cause |
| `-32002` | Resource not found |

Operation failures are never JSON-RPC errors; see [Tools](#tools).

## Limits

The stdio transport refuses a message over 2 MiB before parsing it. Each
operation then enforces its own `limits.inputBytes`, item caps and time
budget (`input-too-large`, `timeout`). Names are capped at 256 characters,
URIs at 2,048 and cursors at 512.

## The remote door

`functions/mcp.ts` is a Cloudflare Pages Function that serves this handler
over stateless Streamable HTTP at `https://texuli.com/mcp`, and the site
middleware answers `/.well-known/mcp` with the same server
([ADR-018](../../../docs/DECISIONS.md#adr-018-the-remote-mcp-on-pages-functions)).
It is live from release 0.9.0 and deploys with the site from `main`.

```text
POST https://texuli.com/mcp
Content-Type: application/json
Accept: application/json, text/event-stream
MCP-Protocol-Version: 2025-11-25

{"jsonrpc":"2.0","id":1,"method":"tools/list"}
```

- **What it serves:** `createMcpHandler({ mode: 'stateless', runtimes:
  ['edge', 'site'] })`, so every tool, resource, prompt and completion above
  except the `node` operations (`document.export`: PDF and DOCX), which are
  not listed and answer `runtime-unavailable`, plus the site tools below. No handshake is required; send
  `initialize` if the host wants one. The protocol version comes from the
  `MCP-Protocol-Version` header (an unsupported one is `400`).
- **Responses:** JSON only, no SSE stream and no `Mcp-Session-Id`. A
  notification gets `202`. A batch of up to 10 messages gets an array of
  the responses to its requests. `GET` gets `405` with a pointer here (an
  agent user agent gets the server card); `OPTIONS` answers CORS.
- **Limits:** a body of at most 256 KB (`413`), at most 10 messages per
  batch, each operation's own caps, a 5 s guard per message (a `tools/call`
  past it is an `isError` result with code `timeout`), and a best-effort
  per-client rate limit of 60 messages per minute (`429` with
  `Retry-After`; every answer carries `RateLimit-Policy` and `RateLimit`).
- **Browsers:** a request with an `Origin` header must come from
  texuli.com, a texuli.pages.dev preview or localhost; server-side agents
  send no `Origin` and are allowed.
- **Security:** its headers, Host check, counters and the optional
  Cloudflare rule are in
  [SECURITY section 21](../../../docs/SECURITY.md#21-remote-mcp-endpoint).

### Site tools (remote only)

`site.pages`, `site.read` and `site.search` list, read and search the pages
of texuli.com as their Markdown twins (PLAN_011 T-ar-site-mcp). The
Function passes each request's `env.ASSETS` binding and origin as the site
context, so they read the deployed build's `md-manifest.json` and twin
files and never the network; a page URL they return uses the request's
origin (texuli.com, or the preview host). `site.read` takes a route, a twin
path or a texuli.com URL, refuses traversal, encoded paths and other hosts
with `invalid-input` and unknown pages with `not-found`, and caps a twin at
256 KiB (`truncated: true`). Ranking, paging and the manifest rules are in
[ops.md](ops.md#site-operations).

```text
{"jsonrpc":"2.0","id":2,"method":"tools/call",
 "params":{"name":"site.search","arguments":{"query":"dark mode","limit":3}}}
{"jsonrpc":"2.0","id":3,"method":"tools/call",
 "params":{"name":"site.read","arguments":{"path":"/guides/theming/"}}}
```

The local doors (stdio, `texuli mcp`, the CLI) do not list them: there is
no built site to read locally, and a local agent reads the repository. The
server card marks them `remote: true, local: false`. The same pages are
offered to browser agents in the page itself through WebMCP
([site-aeo.md](../../../apps/website/docs/site-aeo.md)).

## Tests

`packages/tools/tests/mcp-cli.test.ts` covers `runMcpCli` and `texuli mcp`,
`local-write.test.ts` the write policy, `packages/mcp/tests/mcp.test.ts` the
`@texuli/mcp` entry, and `tests/consumers/mcp.spec.ts` spawns the packed
`texuli-mcp` bin from a clean install (handshake, `tools/list`,
`catalog.search`, exit on stdin close).
`packages/tools/tests/mcp-protocol.test.ts` is the conformance suite: every
method, every JSON-RPC and operation error code, the four versions, cursors,
oversized stdio lines and operation inputs, stateless and stateful handlers,
and the runtime filter. It also checks that the llms resources are
byte-identical to the site's committed snapshots. `mcp.test.ts`,
`deck.test.ts` and `document.test.ts` cover the tools themselves, and
`site-ops.test.ts` the site tools through the stateless handler with a
fake `env.ASSETS`; `apps/website/tests/mcp-function.test.ts` drives them
through the Pages Function.

`tests/agent-evals/` (`pnpm vitest run tests/agent-evals`) replays scripted
agent sessions, with no model, on both doors: the stateful handler as the
stdio server builds it, and the remote Function with real `Request`
objects. The jobs are discovery from cold (including `block.list`), a
pricing page validated with `blueprint.validate` whose table block is
written only from `block.schema`, theming with the `theme-blueprint` prompt and a
Markdown deck conversion, on both doors; every edge operation must answer
identically on both. A fifth job reads the site (`site.search` →
`site.read` → `site.pages`, then a traversal refusal) on the remote door
only, with a fake `env.ASSETS`, and the stdio door is checked to refuse
`site.read` with `runtime-unavailable`. `tool-descriptions.test.ts` there lints every operation's
summary, stated limits, argument descriptions and bounds, closed input
schema and examples. The design-system jobs are skipped until their
operations exist.
