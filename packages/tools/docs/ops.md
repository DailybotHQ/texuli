# Operations registry

**Package:** `@texuli/tools` · **Import:** `@texuli/tools/ops` · **Path:**
`src/ops/` · **Decision:** [ADR-017](../../../docs/DECISIONS.md#adr-017-one-operations-registry-texulitoolsops-for-every-agent-surface)

> **Status: in development, not released.** The `./ops` subpath exists in the
> repository source and is planned for `@texuli/tools` `0.9.0`; no published
> version has it yet. This page is written by hand for now; it will be
> generated from the registry when the surfaces generator lands (planned).

Every capability an agent can call is one **operation**, declared once. Each
has a `group.verb` name, a title, a summary written for agents, a JSON Schema
input and output, annotations, a runtime class, limits and worked examples.
The local MCP server (`src/mcp/`) lists and calls them, and the `texuli
deck`, `texuli document` and `texuli-init theme list|preview` commands run
through the same registry. The registry is framework-free.

## The operations

| Name | Runtime | Summary |
| --- | --- | --- |
| `catalog.search` | edge | Search the built, content-addressed component catalog by text, group and emit tier; returns the catalog hash, the match count and one summary per component (at most 100) |
| `catalog.validate` | edge | Validate one candidate manifest, or a set of at most 500 (which also catches duplicate ids); returns `valid` and diagnostics with a code, a JSONPath, a message and a hint |
| `component.get` | edge | Read one component manifest: props with kinds and schemas, events, examples, `useWhen`/`dontUseWhen`, accessibility notes and emit tiers |
| `example.search` | edge | Find worked manifest examples by component id and/or example id, or by text (at most 100) |
| `blueprint.validate` | edge | Validate a blueprint draft (a tree, a list of trees or an envelope, migrated first) with the catalog's `validateDraft` at the caller's tier; returns `valid`, `status`, `tier`, `migratedFrom` and diagnostics with the catalog's codes |
| `theme.search` | edge | Search the theme library by words, category, collection, mood or tag; returns theme metadata (at most 500, more than the whole library) |
| `theme.get` | edge | Read the full token definition of one theme (light and dark) |
| `theme.preview` | edge | Key tokens of one theme in light or dark mode and the WCAG 2.x AA report for both modes |
| `deck.run` | edge | The seven deck commands on the v2 model ([deck.md](deck.md)); returns `{ result }` |
| `document.run` | edge | Every document command but PDF and DOCX ([document.md](document.md)), including a bounded RFC 6902 patch (at most 1,000 operations); returns `{ result }` |
| `document.export` | node | PDF or DOCX bytes as base64 from the owned writers, links checked at the tier; returns `{ result }`; writes no files |

**Runtime classes.** `edge` operations are pure compute and run anywhere.
`node` operations need Node (here, the PDF and DOCX writers, which are kept
off the edge on purpose). `site` is reserved for remote-only operations that
read the built site; there are none yet. A door passes the classes it serves
(`{ runtimes: ['edge'] }`) and `invoke()` refuses the rest with
`runtime-unavailable`. The catalog operations read the static manifest list
of `@texuli/catalog/manifests/all`, so they need no file system.

**Annotations.** Every operation today is `readOnly: true`,
`destructive: false`, `idempotent: true` and `openWorld: false`; the MCP
server publishes them as `readOnlyHint`, `destructiveHint`, `idempotentHint`
and `openWorldHint`.

## Limits

| Name | Input bytes | Items | Time budget |
| --- | --- | --- | --- |
| `catalog.search` | 4,096 | 100 results | 5 s |
| `catalog.validate` | 1,000,000 | 500 manifests | 5 s |
| `component.get` | 1,024 | — | 5 s |
| `example.search` | 4,096 | 100 results | 5 s |
| `blueprint.validate` | 270,336 (the catalog's 256 KiB tree cap plus 8 KiB) | 512 nodes (the catalog's tree cap) | 5 s |
| `theme.search` | 4,096 | 500 results | 5 s |
| `theme.get`, `theme.preview` | 1,024 | — | 5 s |
| `deck.run` | 2,100,000 (Markdown at most 2,000,000 characters) | — | 10 s |
| `document.run` | 2,100,000 (Markdown at most 2,000,000 characters) | 1,000 patch operations | 10 s |
| `document.export` | 2,100,000 | — | 30 s |

Input bytes are the UTF-8 size of the input as JSON. The time budget is
checked whenever the handler yields (it awaits a promise); a synchronous
handler cannot be interrupted, so the deck commands are bounded by their
input size instead.

## Blueprint validation

`blueprint.validate` wraps `validateDraft` from `@texuli/catalog/validate`
(see the catalog's `docs/validate.md`) so any door can check a blueprint:

- **Input:** `draft` (a catalog tree `{ id, props, children }`, an array of
  trees, or a `texuli-blueprint` envelope), `tier` (`untrusted`, the
  default, or `developer`) and `fragment` (`true` accepts any roots; by
  default the single root must be `layout-page`, `layout-doc`,
  `layout-deck`, `document`, `canvas` or `data-dashboard`).
- **What runs:** the catalog's checks in order (input, envelope, structure,
  interaction, sinks, limits, render, blocks, documents, forms, canvases,
  sheets, grammar, root), against the catalog `catalog.search` reports
  (an envelope written for another catalog hash fails with
  `catalog-mismatch`), with the deep block family schemas and
  `validateDocument` from `@texuli/document/schema` for `document` nodes.
  The tier the draft declares is ignored, as in every host.
- **Output:** `valid` (true only with no error diagnostics), `status`
  (`valid`, `invalid`, `parse` or `over-limits`), `tier`, `migratedFrom`
  (the spec version an envelope declared, when it was migrated; an envelope
  without `spec` is `0.2.0`) and `diagnostics`, each with `check`, `code`,
  `severity`, `path`, `message` and, for a node, its `id`. The codes are the
  catalog's own (`sink`, `tier-denied`, `nodes-exceeded`, `frame-root`,
  `catalog-mismatch` …); the catalog has no `hint` field, so none is added.
- **Not checked on this server:** `schema-form`, `canvas` and `spreadsheet`
  nodes and `{"$source": …}` bindings are refused (`form-unchecked`,
  `canvas-unchecked`, `sheet-unchecked`, and source bindings), because `@texuli/tools`
  does not depend on `@texuli/forms`, `@texuli/canvas` or `@texuli/sheets`
  and holds no data sources. The full spec check of an envelope
  (`validateBlueprint` from `@texuli/spec`) is skipped for the same reason;
  the catalog-local interaction check always runs. When `when` conditions
  appear, they are refused (`invalid-condition`): no condition runtime is
  passed.

## Library

```ts
import { TEXULI_OPERATIONS, texuliOps } from '@texuli/tools/ops';

texuliOps.list({ runtimes: ['edge'] }); // what a remote door may serve
const outcome = await texuliOps.invoke('catalog.search', { query: 'card', tier: 'untrusted', limit: 5 });
if (outcome.ok) outcome.output; // { hash, fileName, total, entries, limit }
else outcome.error; // { code, message, issues? }
```

`invoke(name, input, { runtimes })` never throws. It checks the input is a
plain JSON object within `limits.inputBytes`, validates it against the
input schema, runs the handler under the time budget, and validates the
output against the output schema. `createOperationRegistry(operations,
aliases)` builds another registry (an adopter's own operations, or a test
double); it refuses duplicate names and schemas outside the supported
subset. `defineOperation` types a declaration; `TOOLS_VERSION` is the
package version, read from `package.json` (the MCP `serverInfo.version`).

### Error codes

| Code | When |
| --- | --- |
| `unknown-operation` | The name is neither an operation nor an alias |
| `invalid-input` | The input is not a JSON object, has a cycle, or fails the input schema (`issues` lists each failure with a JSONPath) |
| `input-too-large` | The input is over `limits.inputBytes` |
| `not-found` | A named thing does not exist (an unknown component or theme id) |
| `runtime-unavailable` | The door does not serve the operation's runtime class |
| `invalid-output` | The handler returned output outside its output schema (a bug in Texuli) |
| `timeout` | The handler ran past `limits.timeMs` |
| `operation-failed` | The handler threw an unexpected error |

### Schemas

The validator is owned code (`src/ops/schema.ts`, `validateJson`) for the
subset of JSON Schema 2020-12 the operations use: `type`, `enum`, `const`,
`properties`, `required`, `additionalProperties`, `items`, `minItems`,
`maxItems`, `minLength`, `maxLength` (code points), `pattern` (Unicode),
`minimum` and `maximum`, plus the annotations `title`, `description`,
`default`, `examples` and `$comment`. A schema that uses any other keyword is
refused when the registry is built (`schemaKeywordIssues`), so no constraint
is silently ignored. Every input schema is an object with
`additionalProperties: false`, so unknown arguments are refused by name.

## Deprecated 0.8 tool names

The seven MCP tool names of `0.8` stay as aliases for one minor and are
removed in `0.10.0`. Their MCP descriptions start with "Deprecated alias
of …".

| Alias | Resolves to |
| --- | --- |
| `catalog` | `catalog.search` |
| `component` | `component.get` |
| `validate` | `catalog.validate` |
| `example` | `example.search` |
| `theme` | `theme.get` when `id` is given, otherwise `theme.search` |
| `deck` | `deck.run` |
| `document` | `document.export` for `to-docx` and `to-pdf`, otherwise `document.run` (the legacy input schema, with all ten commands) |

An alias returns exactly what its target returns.

## Doors that use it today

- **MCP (in the repository source):** `createMcpHandler` ([mcp.md](mcp.md))
  generates `tools/list` from the registry: every operation of the runtime
  classes the door serves (`edge` and `node` for the local stdio server),
  with `inputSchema`, `outputSchema`, `annotations` and cursor pagination,
  then the aliases. A call goes through `invoke()` and returns
  `structuredContent` plus a text mirror; a failure is an `isError` result
  whose JSON has `error`, `code` and, for schema failures, `issues`. An
  unknown tool name is a JSON-RPC `-32602` error. The same handler serves
  the resources, prompts and completions.
- **CLI:** `texuli deck …` runs `deck.run`; `texuli document …` runs
  `document.run`, or `document.export` for `to-docx` and `to-pdf`;
  `texuli-init theme list` and `theme preview` run `theme.search` and
  `theme.preview`. `theme apply` and `init` use the same theme helpers
  (`themeExists`, `themeCss`) from `src/ops/themes.ts`.

Planned (not built yet): the generated `texuli <group> <verb>` router, the
`texuli-mcp` binary, the remote endpoint for `edge` operations, and the
generated server card, llms section and this page.

## Tests

`packages/tools/tests/ops.test.ts` checks that every operation is declared
once in the schema subset, round-trips every example through its input and
output schemas, refuses bad input with each error code, resolves every
alias to the same result as its target, reads the version from
`package.json`, and that the CLI runs through the registry.
The same file checks `blueprint.validate` on golden and hostile fixtures,
envelope migration, the catalog hash, deep block checks, the frame root,
the node cap and the input cap.
`packages/tools/tests/mcp.test.ts` covers the MCP tool list and calls,
`packages/tools/tests/mcp-protocol.test.ts` is the MCP conformance suite, and
`packages/catalog/tests/manifests-all.test.ts` checks the static manifest
list builds the same catalog hash as file-system discovery.
