# Deck commands

**Package:** `@texuli/tools` · **Import:** `@texuli/tools/deck` ·
**CLI:** the `deck` command of `texuli` (`src/cli/texuli.ts`), also the
`texuli-deck` bin (`src/cli/deck.ts`) · **MCP:** the read-only `deck` tool
of the local server in `src/mcp/` · **Path:** `src/deck/`

> **Status: in development, new in `0.4.0`.** The `./deck` subpath, the
> `texuli` and `texuli-deck` bins and the `deck` MCP tool ship in
> `@texuli/tools` `0.4.0`; `0.3.0` installs `texuli-init`, `texuli-add`,
> `texuli-update` and `texuli-llms` only. They build on `@texuli/deck`
> `0.4.0`, its first release ([RELEASE](../../../docs/RELEASE.md)). The MCP server has no export and no
> registered command.

Agent and developer commands for decks, on the shared v2 deck model of
`@texuli/deck`: read what the deck format supports, validate and lint a
deck, summarize it, and convert between JSON and the deck Markdown dialect.
Every command is a pure function of its input: it reads no files (the CLI
reads the one file you name), writes nothing and uses no network.

## The seven commands

| Command | Input | Output |
| --- | --- | --- |
| `capabilities` | none | The deck format version, the command list, layout ids, brief outline ids, templates and the accepted sources (`json`, `markdown`) |
| `schema` | none | The v2 deck JSON Schema (`deckJsonSchema`, `$id` `https://texuli.com/schemas/deck-v2.json`) |
| `layouts` | none | Every layout catalog entry (props schema, sample, `useWhen`, `dontUseWhen`, pacing, limits) |
| `lint` | a JSON deck | `lintDeck`: the model errors plus quality warnings (missing or boilerplate notes, layout repetition, too many words, unrevealed steps), at most 200 listed (`truncated` past it) |
| `inspect` | a JSON deck | `ok`, `meta`, `slideCount`, the outline, one summary per slide (id, title, layout, hidden, notes) and `slideRefs` |
| `from-markdown` | deck Markdown | `parseDeckMarkdown`: `ok`, the `deck` and its `issues` |
| `to-markdown` | a JSON deck | `deckToMarkdown` of a valid deck, or `ok: false` with the model issues |

## Library

```ts
import { DECK_COMMANDS, runDeckCommand } from '@texuli/tools/deck';

DECK_COMMANDS; // the seven command names, in the order above
const report = runDeckCommand('lint', { deck });          // a JSON deck value
const parsed = runDeckCommand('from-markdown', { markdown }); // deck Markdown text
```

`runDeckCommand(command, input)` is the adapter the CLI and the MCP tool
share (`DeckCommandName`, `DeckCommandInput`). A missing or invalid input
answers `ok: false` with `issues` (or an `error` for `from-markdown`) instead
of throwing.

## CLI

From a Texuli checkout:

```bash
pnpm exec tsx packages/tools/src/cli/texuli.ts deck capabilities
pnpm exec tsx packages/tools/src/cli/texuli.ts deck lint --file <deck.json>
pnpm exec tsx packages/tools/src/cli/texuli.ts deck from-markdown --file <deck.md>
```

`texuli deck <command> [--file <path> | --text <source>]`. `lint`,
`inspect` and `to-markdown` read a JSON deck, `from-markdown` reads
Markdown; without `--file` or `--text` they read stdin. Input is capped at
2,000,000 bytes: a `--file` is checked with `stat` first, and one over the
cap or not a regular file (a directory, a device) is refused without being
read (`readDeckFile`); stdin stops at the cap. The result prints as JSON on stdout, and the exit code is 1
when the result is not `ok` (an invalid deck, for example) or the arguments
are wrong (an unknown command or flag, both `--file` and `--text`, JSON that
does not parse). `--help` prints the usage and the command list. The
`texuli-deck` bin is the same command without the `deck` word.

## MCP tool

The local MCP stdio server (`src/mcp/stdio.ts`, newline-delimited JSON-RPC)
lists a read-only `deck` tool next to its catalog, component, validate,
example and theme tools. Its arguments are `command` (one of the seven),
`deck` (a JSON deck for `lint`, `inspect` and `to-markdown`) and `markdown`
(for `from-markdown`, at most 2,000,000 bytes); unknown arguments are
refused. It answers `{ "result": … }` with the same value as the CLI and
modifies no files.

In the repository source (in development, not released), the tool is the
`deck.run` operation of the [operations registry](ops.md), and the CLI runs
through it too. The 0.8 tool name `deck` was a deprecated alias in `0.9.0`
and is removed in `0.10.0` (on the release branch): call `deck.run`.

```json
{ "command": "lint", "deck": { "formatVersion": 2, "meta": { "title": "Launch" }, "slides": [] } }
```

## Tests

`packages/tools/tests/deck.test.ts` covers the commands, the CLI argument
parser and its failures; `packages/tools/tests/mcp.test.ts` covers the MCP
tool list and calls.
