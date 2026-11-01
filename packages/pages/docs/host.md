# `@texuli/pages/host`

The document host for [`@texuli/player`](../../player/README.md): agents
write a `document` blueprint node (spec 0.7.0, ADR-011) and the player paints
it with the read-only reader. The player (L7) cannot import this package
(L8), so it takes the host through its `documentHost` seam.

> **Status: in development.** On npm from `0.7.0`, the package's first
> release (pre-1.0).

```svelte
<script lang="ts">
  import { createDocumentPlayerHost } from '@texuli/pages/host';
  import { Player } from '@texuli/player';
  import '@texuli/player/styles.css';

  let { draft } = $props(); // agent output: a blueprint whose root is a `document` node
  const documentHost = createDocumentPlayerHost({ pageHref: (ref) => `/docs/${ref}/` });
</script>

<Player blueprint={draft} label="Agent document" {documentHost} />
```

## `createDocumentPlayerHost(options)`

Returns a `DocumentPlayerHost` (the player's type):

- `checkDocument` is `createDocumentDraftCheck(validateDeck)` (inline decks
  checked with `checkDeckPayload` by default): the player passes it to
  `validateDraft`, which runs it for every `document` node at the player's
  tier (`untrusted` by default, never a tier the draft claims). The catalog
  then checks what the document borrows from the catalog at the same tier:
  wrapped blocks as their `blocks-<family>` id, component embeds as their
  catalog id. Without a host the player refuses every document
  (`document-unchecked`).
- `present` validates the document again, then mounts `PageReader` into
  the player's surface. The reader is imported on first use, so a page
  without documents never loads it. A document that does not validate
  paints nothing. The returned cleanup unmounts the reader, or cancels a
  mount still loading.

`DocumentPlayerHostOptions`:

| Option | Default | Meaning |
| --- | --- | --- |
| `labels` | English | Partial `PagesLabels` for the reader |
| `headingOffset` | `1` | Added to every heading level, so the document's level-1 heading sits under the player's label |
| `anchorPrefix` | the node key and `-` | Prefix for heading anchors |
| `onNavigate`, `pageHref` | — | Page links, as in the reader |
| `resolveEmbed`, `resolveMedia` | — | Embeds and media, as in the reader |
| `reducedMotion` | `false` | Paint embeds without motion |
| `loadPlayer` | the package loader | A `PagesPlayerLoader` for embeds inside the document; `null` turns them off ([core entries](editor.md#core-entries-without-the-player)) |
| `validateDeck` | `checkDeckPayload` (`createDocumentPlayerHost`); none on `createDocumentPlayerHostCore` | A `DeckPayloadValidator` for inline decks; `null` refuses them. Without one the core host's build has no `@texuli/deck/model` reference and a document holding an inline deck is refused (G136, from `0.12.0`) |
| `loadLibraryBase` | the theme library (`createDocumentPlayerHost`); none on `createDocumentPlayerHostCore` | A `PagesLibraryBaseLoader` for the reader's design-system `texuli:<theme>` bases; `null` refuses them ([design systems](reader.md#design-systems); G127, from `0.11.0`) |
| `renderBlock`, `blockHost` | — | The host's own blocks in the painted document, passed to the reader ([host blocks](editor.md#host-blocks); from `0.10.0`). The player validates the document against the catalog first, so a wrapped block the catalog does not know is refused before the reader sees it; here the host paints what passes: embeds the library cannot paint (a `ref` with no payload) and library blocks it claims with `'host'` |

The node's `outline` prop goes to the reader's `outline`.

## `createDocumentPlayerHostCore(options)`

> **New in `0.10.0`.**

From `@texuli/pages/host-core` (and `@texuli/pages/host`): the same host,
mounting `PageReaderCore`, with no default `loadPlayer` (G123). A host on
this entry has no `@texuli/player` reference of its own in its build; the
`Player` the host renders is the host's import. Embeds inside the document
paint only with `options.loadPlayer` (a `PagesPlayerLoader` whose result is
a `PagesPlayerModule`, for example `() => import('@texuli/player')`, since
the host already has the player); without it they show a note.
It has no default `options.loadLibraryBase` either (G127, from
`0.11.0`): pass `loadPagesLibraryBase` to resolve a design
system's `texuli:<theme>` bases from the token theme library.
It has no default `options.validateDeck` either (G136, from `0.12.0`): pass
`checkDeckPayload` from `@texuli/document/schema` to accept inline decks.
`@texuli/pages/host-core` also exports `checkDocumentDraft`,
`createDocumentDraftCheck`,
`DocumentPlayerHostOptions`, `loadPagesLibraryBase` and
`PagesLibraryBaseLoader`. See
[core entries](editor.md#core-entries-without-the-player).

## `createDocumentDraftCheck(validateDeck)` and `checkDocumentDraft(doc, tier)`

The `DraftDocumentCheck` behind the host, for hosts that validate without
painting (servers, tools): `validateDocument` from
`@texuli/document/schema-core` with `trust` set to the tier and inline decks
checked by `validateDeck`. Errors refuse; warnings (orphaned comment
anchors) do not. `checkDocumentDraft` is the check with no deck validator:
from `0.12.0` it refuses inline decks (G136); use
`createDocumentDraftCheck(checkDeckPayload)` to accept them.

```ts
import { validateDraft } from '@texuli/catalog/validate';
import { checkDeckPayload } from '@texuli/document/schema';
import { createDocumentDraftCheck } from '@texuli/pages/host';

const checkDocument = createDocumentDraftCheck(checkDeckPayload);
const result = validateDraft(agentOutput, { catalog, checkDocument });
```
