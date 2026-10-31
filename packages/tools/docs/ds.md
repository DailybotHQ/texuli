# Design-system operations: `ds.*`, `blueprint.theme` and `texuli ds`

> **Status: released in `0.10.0`.** The operations, the
> `create-design-system` prompt, the `texuli://design-system/{id}`
> resources and the `texuli ds` commands ship in `@texuli/tools@0.10.0`
> and `@texuli/mcp@0.10.0` (PLAN_011 T-ds-agent-tools). The remote endpoint
> at `https://texuli.com/mcp`, deployed with texuli.com from `main`, serves
> the edge ones. The Kotlin, email, PDF, DOCX, PPTX and canvas outputs of a
> design system ship in the same release (`designValues` from
> `@texuli/tools/print` and `@texuli/tools/email`; see
> [docs/DESIGN_SYSTEMS.md](../../../docs/DESIGN_SYSTEMS.md)).

The developer and agent guide is
[DESIGN_SYSTEMS](../../../docs/DESIGN_SYSTEMS.md). An agent authors a design system
([the document](../../spec/docs/design-system.md)) through the same
[operations registry](ops.md) as everything else, so the local MCP
(`texuli-mcp`), the remote MCP and the CLI give the same answers. Every
operation but `ds.save` is `edge`: pure, deterministic compute over
[`@texuli/tokens/design-system/*`](../../tokens/docs/design-system-compiler.md)
and the static half of [`texuli ds check`](ds-check.md), loaded lazily
(`src/ops/design-system-run.ts`), so a door that never runs one never loads
the compiler, the importers or the emitters.

## Operations

| Operation | Input (besides `document`) | Output |
| --- | --- | --- |
| `ds.validate` | `trust`, `variant`, `bases` | `valid`, `codes`, `errors` (code, JSON path, message, hint, pairs), `warnings`, `hash`, the checked `variants` |
| `ds.compile` | `format` (`json`, `css`, `tailwind`, `dtcg`, `tokens-studio`), `selector`, `dark`, `mode`, `trust`, `variant`, `bases` | `valid`, `format`, `mediaType`, `content` (text), `bytes`, `hash`, `warnings` |
| `ds.contrast` | `mode`, `trust`, `variant`, `bases` | `contrast` (AA or AAA), `targetMin`, per mode `{ total, failing, pairs }`, the solver `adjustments` |
| `ds.suggest` | exactly one of `seed`, `colors` (up to 3) or `pixels` (RGBA, up to 65,536 values); `count`, `id`, `name`, `version` | a valid `document`, the dominant `palette` (pixels), the key tokens per mode (`roles`) |
| `ds.import` | `from` (`brand`, `dtcg`, `tokens-studio`, `role-palette`, `theme`), `input` (text or object; a library theme id for `theme`), `id`, `name`, `version`, `trust` | a valid `document` and `warnings` for every value it dropped |
| `ds.diff` | `before`, `after` (documents), `mode`, `trust`, `variant`, `bases` | `identical`, `summary`, `tokens`, `contrast` regressions, `defaults`, `attrs` |
| `ds.preview` | `format` (`svg` or `html`), `title`, `mode`, `trust`, `variant`, `bases` | `content`, `mediaType`, `bytes`, `hash` |
| `ds.save` (node) | `path` (required), `overwrite`, `dryRun`, `trust`, `variant`, `bases` | `saved`, `path` (relative), `bytes` |
| `blueprint.theme` | `blueprint` (an envelope, or a tree to wrap), `designSystem` (`{ ref }` or `{ inline }`), `tier`, `id` | `valid`, `status`, the themed `blueprint`, `diagnostics` |

The exact schemas, limits and worked examples are in the generated
[operations table](ops.md#operations) and in `texuli ds <verb> --help`.
Limits: 1 MiB of JSON input (the importers' cap; the remote endpoint caps a
request body at 256 KB), 10 s.

- **Refusals are results.** A document the spec or the compiler refuses is
  `valid: false` with `errors`, never a tool error: the codes are the
  spec's (`unknown-key`, `invalid-type`, `invalid-value`, `required`,
  `format-version`, `extends-range`, `extends-cycle`, `extends-depth`,
  `url-refused`, `inline-bytes`) and the guarantees' (`aa-text`, `aa-focus`,
  `target-size`), with `$`-rooted JSON paths, the same codes `texuli ds
  check` prints. `ds.diff` tags each error with `source: "before"` or
  `"after"`; `ds.suggest` and `ds.import` add `invalid-input`,
  `input-limit` and `not-found` (an unknown theme id).
- **Bases.** `extends: "texuli:<theme>"` loads from the theme library (lazy,
  never the network). `extends: "id@x.y.z"` is resolved from `bases`
  (`{ "id@version": document }`); nothing is fetched.
- **Deterministic.** The same document gives byte-equal output in any key
  order, on every door (the parity tests compare the stdio handler and the
  Pages Function). `ds.compile` with `dtcg` or `tokens-studio` emits the
  document itself (lossless: `ds.import` reads it back to the same
  document); the other formats emit the compiled values.
- **Preview.** `svg` is a compact snapshot (key role swatches, a primary
  button, a card and the contrast count per mode) with a fixed font stack,
  fixed geometry, no time and no random ids. Every text and attribute goes
  through `escapeHtml` of the report emitter, and a color is painted only
  when it passes `isSafeCompiledValue` and a closed color form (else a
  neutral gray). `html` is the report page of `emitReportHtml` (no script,
  a `default-src 'none'` CSP meta). Nothing is ever parsed as markup.
- **`ds.save`** validates the document as `ds.validate` does and writes
  two-space JSON through the door's local writer
  ([local write policy](mcp.md#the-local-door)): an explicit path inside the
  working directory; traversal, absolute paths outside it and symlinked
  components are refused (`outside-working-directory`, `symlink`), and an
  existing file needs `overwrite` (`exists`). `dryRun` checks the document
  and the path and writes nothing. The remote door does not list it, and a
  door without a writer answers `runtime-unavailable`.
- **`blueprint.theme`** sets the envelope's `designSystem` (spec `0.10.0`,
  [ADR-024](../../../docs/DECISIONS.md#adr-024-design-systems-on-every-surface)),
  wrapping a bare tree in a draft envelope for the current catalog (id
  `draft` unless `id` is given; fixed `1970-01-01T00:00:00.000Z` timestamps
  keep the output deterministic, and the host sets real ones when it saves),
  then validates it as `blueprint.validate` does. A `texuli:<id>` that names
  no library theme is `invalid-value` at `$.designSystem.ref`; an inline
  document is also compiled, so its guarantee codes land under
  `$.designSystem.inline…`. The result stays a `draft`: only the host
  activates a blueprint.
- **`blueprint.validate`** passes the spec's `checkDesignSystemReference`
  as the catalog's `checkDesignSystem` hook, so an inline document's spec
  codes are reported under `$.designSystem` at the caller's tier (agent
  output refuses every `data:` URL).

## MCP prompt and resources

- **`create-design-system`** (`brief`, `base`, `contrast`): the loop from a
  brief to a validated document: read the examples, start from `ds.import`
  or `ds.suggest`, write the sections, `ds.validate` and fix by code until
  valid, `ds.contrast` and `ds.preview`, then deliver with `ds.compile`,
  `blueprint.theme` or `ds.save` ([mcp.md](mcp.md#prompts)).
- **`texuli://design-system/{id}`**: the fictional examples (the spec's
  `acme` and `minimal`, and the guide's brands `quillmark`, `ledgerline`
  and `tumbletown` from `examples/design-systems/`; listed) and every
  library theme as a document (completed, not listed, read one at a time)
  ([mcp.md](mcp.md#resources)).

## CLI

```bash
texuli ds init brand.ds.json --name Harborline         # a starter document; --brand takes a one-liner
texuli ds validate brand.ds.json                       # JSON result; exit 1 when refused
texuli ds compile brand.ds.json --format css --out dist/brand.css
texuli ds export brand.ds.json --format dtcg --out tokens/brand.tokens.json
texuli ds preview brand.ds.json --format svg --out review/brand.svg
texuli ds diff brand.ds.json next.ds.json
texuli ds import tokens/brand.tokens.json --from dtcg --out imported.ds.json
texuli ds import ocean --from theme --out ocean.ds.json
texuli ds check brand.ds.json --render                 # the conformance check (ds-check.md)
```

Each command reads its files, runs one operation (`init` and `import` run
`ds.import`, then `ds.save` for the file) and prints its JSON. With `--out`
the content (CSS, preset, token file, preview or document) is written
through the local write policy instead, and a receipt is printed. `--base
<file>` (repeatable) provides `extends: "id@x.y.z"` bases. Exit codes: 0
valid, 1 refused (a `valid: false` result or a refused write), 2 could not
run (a bad flag or an unreadable file). `texuli ds <verb> --json <object>`
is the operation form with the operation's own input
([ops.md](ops.md#doors-that-use-it-today)); `check` keeps its own flags ([ds-check.md](ds-check.md)).
