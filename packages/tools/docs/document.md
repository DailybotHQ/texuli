# Document commands

**Package:** `@texuli/tools` · **Import:** `@texuli/tools/document` ·
**CLI:** the `document` command of `texuli` (`src/cli/texuli.ts`, handled
by `src/cli/document.ts`) · **MCP:** the read-only `document` tool of the
local server in `src/mcp/` · **Path:** `src/document/`

> **Status: in development, new in `0.7.0`.** The `./document` subpath, the
> `document` command and the `document` MCP tool ship in `@texuli/tools`
> `0.7.0`, with the first release of `@texuli/document`
> ([RELEASE](../../../docs/RELEASE.md)); `0.6.0` predates them.

Agent and developer commands for Texuli documents (spec 0.7.0, ADR-011), on
`@texuli/document`: read what the format supports, create a document from
Markdown, validate it at a tier, summarize it, apply a bounded RFC 6902
patch, wrap it as a `document` blueprint, and export Markdown, DOCX or PDF.
`runDocumentCommand(command, input)` is the pure adapter both surfaces
share: it reads and writes no files, uses no network and never throws (a
failure is `{ ok: false, … }`).

## The ten commands (`DOCUMENT_COMMANDS`)

| Command | Input (`DocumentCommandInput`) | Output |
| --- | --- | --- |
| `capabilities` | none | The format and version, the spec (`DOCUMENT_BLUEPRINT_SPEC`, `0.7.0`), the `document` catalog id, the commands, block types, block families, embed kinds, the patch operations and their cap (1,000), the limits, sources and exports |
| `schema` | none | The document JSON Schema (`documentJsonSchema`), the same file the spec pins as `schemas/document.schema.json` |
| `validate` | `document`, `tier` | `{ ok, tier, issues }`: issues have `code`, `path`, `message` and `severity` (at most 50) |
| `inspect` | `document`, `tier` | The metadata, top-level block count, node count, block types, the heading outline, character count and comment threads |
| `patch` | `document`, `patch`, `tier` | `applyDocumentPatch` on the validated document: `{ ok, document, inverse }`, or the failing `index` and `reason`. All or none; prototype paths and unsafe results are refused |
| `from-markdown` | `markdown`, `tier` | `documentFromMarkdown`: `{ ok, document, diagnostics }`; raw HTML stays inert text |
| `to-markdown` | `document`, `tier` | `{ ok, markdown }` |
| `to-blueprint` | `document`, `tier`, `key` (default `document`), `id` | A spec 0.7.0 draft envelope whose tree is `{ key, id: "document", props: { doc } }`; the host still validates it with `validateDraft` and its `checkDocument` |
| `to-docx` | `document`, `tier` | `{ ok, mime, byteLength, base64, diagnostics }` from `writeDocx` (loaded on use) |
| `to-pdf` | `document`, `tier` | `{ ok, mime, byteLength, pageCount, base64, diagnostics }` from `writePdf` (loaded on use) |

`tier` (`DocumentTier`) is `untrusted` by default: links and media pass the
untrusted URL policy (relative and plain `http:` links are refused). Pass
`developer` only for documents a person wrote in a trusted tool. Every
command but `capabilities`, `schema` and `from-markdown` validates the
document first and refuses an invalid one.

## CLI

```bash
pnpm exec tsx packages/tools/src/cli/texuli.ts document capabilities
pnpm exec tsx packages/tools/src/cli/texuli.ts document from-markdown --file <notes.md>
pnpm exec tsx packages/tools/src/cli/texuli.ts document validate --file <doc.json> --tier untrusted
pnpm exec tsx packages/tools/src/cli/texuli.ts document patch --file <doc.json> --patch <patch.json>
pnpm exec tsx packages/tools/src/cli/texuli.ts document to-blueprint --file <doc.json> --key brief
pnpm exec tsx packages/tools/src/cli/texuli.ts document to-docx --file <doc.json> --out <brief.docx>
```

`runDocumentCli(argv)` and `parseDocumentCliArgs(argv)` (`DocumentCliArgs`)
are the CLI: the input comes from `--file` (a regular file of at most
2,000,000 bytes, checked before it is read), `--text` or stdin, and the
output is JSON on stdout. `--patch` names the patch file (`patch` only),
`--key` the node key (`to-blueprint` only) and `--tier` the URL tier.
`--out` (`to-markdown`, `to-docx`, `to-pdf` only) writes the Markdown or
the decoded bytes to a **new** file, refusing one that exists, and prints a
summary without the base64. A refused document exits 1.

## MCP tool

The local MCP server lists a read-only `document` tool with the same
commands: `command` (one of `DOCUMENT_COMMANDS`), `document`, `markdown`,
`patch` (at most 1,000 operations), `tier` and `key`; unknown arguments,
other tiers and inputs over 2,000,000 bytes are refused. DOCX and PDF come
back as base64; the tool writes no files.

## Tests

`packages/tools/tests/document.test.ts`: every command, hostile documents
and Markdown, patches with exact inverses, DOCX and PDF bytes, the strict
CLI surface, a file written once and never overwritten, and the MCP tool's
closed schema and parity with the CLI.
