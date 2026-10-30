# MCP protocol layer

**Package:** `@texuli/tools` · **Path:** `src/mcp/` (no package export yet) ·
**Decisions:** [ADR-017](../../../docs/DECISIONS.md#adr-017-one-operations-registry-texulitoolsops-for-every-agent-surface),
[ADR-018](../../../docs/DECISIONS.md#adr-018-the-remote-mcp-on-pages-functions)

> **Status: in development, not released.** The protocol layer exists in the
> repository source and is planned for `@texuli/tools` `0.9.0`. There is no
> published command or package export for it yet: the `texuli-mcp` binary
> is a later task of the same plan. The remote endpoint for texuli.com is in
> the repository (see [The remote door](#the-remote-door)) but is not
> deployed until release 0.9.0 merges to `main`. Today the protocol runs
> from a checkout with `pnpm exec tsx packages/tools/src/mcp/stdio.ts`.

`createMcpHandler` turns the [operations registry](ops.md) into an MCP
server. It is transport-independent and edge-safe (no Node built-ins): one
JSON-RPC message in, one response out, or nothing for a notification. The
stdio transport (`runMcpStdio`, `src/mcp/stdio.ts`) uses it, and the remote
HTTP endpoint ([The remote door](#the-remote-door)) uses the same handler in
stateless mode.

```ts
import { createMcpHandler } from './src/mcp/index.ts'; // repository source; no export yet

const local = createMcpHandler({ mode: 'stateful' }); // stdio: edge + node operations
const remote = createMcpHandler({ mode: 'stateless', runtimes: ['edge'] }); // HTTP
const response = await remote(
  { jsonrpc: '2.0', id: 1, method: 'tools/list' },
  { protocolVersion: '2025-11-25' } // the MCP-Protocol-Version header
);
```

## Options

| Option | Default | Meaning |
| --- | --- | --- |
| `registry` | every Texuli operation | The operations served as tools |
| `mode` | `stateful` | `stateful` keeps the initialization gate (stdio); `stateless` never requires it (HTTP) |
| `runtimes` | `['edge', 'node']` | The runtime classes served; a remote door passes `['edge']` |
| `capabilities` | all on | `{ resources, prompts, completions }`: `false` switches one off |
| `resources` | the Texuli resources | Resource providers; an empty list advertises no resources |
| `prompts` | the Texuli prompts | Prompts; an empty list advertises no prompts |
| `pageSize` | 100 | Items per page of every list method |

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
handler) gives `runtime-unavailable`. A name the registry does not know is a
`-32602` protocol error.

## Resources

| URI | Type | Content |
| --- | --- | --- |
| `texuli://catalog` | JSON | The content-addressed catalog: the exact bytes whose SHA-256 is the catalog hash |
| `texuli://llms/full` | Markdown | Every component page in one file, identical to `/llms/llms-full.txt` on the site |
| `texuli://component/{id}` | JSON | One catalog entry (the manifest with group and emit tiers) |
| `texuli://docs/{slug}` | Markdown | One component's agent page, identical to `/llms/components/<id>.md` on the site |
| `texuli://theme/{id}` | JSON, then CSS | The full light and dark theme definition, then its compiled CSS |
| `texuli://schema/{name}` | JSON | The JSON Schema of `deck` or `document` |

`resources/list` lists the two fixed resources, both schemas, then every
component, every component page and every library theme (paginated).
`resources/templates/list` returns the four templates. An unknown URI is
`-32002` (resource not found) with `data: { uri }`; a missing, non-string or
over-2,048-character URI is `-32602`.

**What is not served yet, and why:**

- **Package guides** (`packages/<pkg>/docs/*.md`): about 300 files and
  1.5 MB, too large to bundle into an edge handler. `texuli://docs/{slug}`
  is scoped to the component pages, which are computed from the catalog the
  handler already holds. Reading the site's Markdown twins is planned as the
  `site` operations of ADR-018.
- **`texuli://schema/blueprint`:** the blueprint JSON Schema lives only in
  `@texuli/spec` (`schemas/blueprint.schema.json`); `@texuli/catalog` exports
  no copy of it, and `@texuli/tools` does not depend on `@texuli/spec` yet
  (adding it needs a lockfile change). An agent checks a blueprint with the
  `blueprint.validate` tool instead.
- **`texuli://design-system/{id}`** and the design-system schema: they come
  with design systems (Part B of the plan). The template is omitted, not
  registered empty, so an agent never sees a resource that cannot be read.

## Prompts

| Prompt | Arguments | The loop |
| --- | --- | --- |
| `build-ui` | `brief` (required), `tier` (`untrusted` or `developer`), `theme` | `catalog.search` → `component.get` (keep by useWhen, drop by dontUseWhen) → `example.search` → compose a catalog tree → `blueprint.validate` until `valid` is true |
| `theme-blueprint` | `brief` (required), `mode` (`light` or `dark`), `theme` | `theme.search` → shortlist → `theme.preview` (keep `aa.pass`) → `theme.get` → how the host applies it |
| `convert-deck` | `direction` (required: `from-markdown` or `to-markdown`), `source` | `deck.run` capabilities and layouts → convert → lint until no errors → round-trip check |

The texts follow the skill's loops (`skills/texuli/build-ui`, `themes` and
the deck reference). Each names only real operations and served resources;
the suite checks that. `create-design-system` comes with design systems
(planned). `build-ui` validates through the `blueprint.validate` tool, so
an agent can finish the loop through the protocol alone. `prompts/get` refuses an unknown
prompt, a missing required argument, an unknown argument, a non-string value,
a value outside its enum and a value over its length cap (10,000 characters,
or 2,000,000 for `source`) with `-32602`.

## Completions

`completion/complete` completes the template variables (component ids for
`component/{id}` and `docs/{slug}`, theme ids, schema names) and the prompt
arguments (`theme` from the library, and the enums of `tier`, `mode` and
`direction`). Matching is a case-insensitive prefix. At most 100 values are
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
**It is not deployed yet:** it goes live when release 0.9.0 merges to
`main`. Until then, the URL below answers with the site's 404.

```text
POST https://texuli.com/mcp
Content-Type: application/json
Accept: application/json, text/event-stream
MCP-Protocol-Version: 2025-11-25

{"jsonrpc":"2.0","id":1,"method":"tools/list"}
```

- **What it serves:** `createMcpHandler({ mode: 'stateless', runtimes:
  ['edge'] })`, so every tool, resource, prompt and completion above except
  the `node` operations (`document.export`: PDF and DOCX), which are not
  listed and answer `runtime-unavailable`. No handshake is required; send
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

## Tests

`packages/tools/tests/mcp-protocol.test.ts` is the conformance suite: every
method, every JSON-RPC and operation error code, the four versions, cursors,
oversized stdio lines and operation inputs, stateless and stateful handlers,
and the runtime filter. It also checks that the llms resources are
byte-identical to the site's committed snapshots. `mcp.test.ts`,
`deck.test.ts` and `document.test.ts` cover the tools themselves.
