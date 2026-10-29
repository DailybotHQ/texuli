# `@texuli/pages/host`

The document host for [`@texuli/player`](../../player/README.md): agents
write a `document` blueprint node (spec 0.7.0, ADR-011) and the player paints
it with the read-only reader. The player (L7) cannot import this package
(L8), so it takes the host through its `documentHost` seam.

> **Status: in development.** Not on npm yet (first release planned for
> `0.7.0`).

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

- `checkDocument` is `checkDocumentDraft`: the player passes it to
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

The node's `outline` prop goes to the reader's `outline`.

## `checkDocumentDraft(doc, tier)`

The `DraftDocumentCheck` behind the host, for hosts that validate without
painting (servers, tools): `validateDocument` from
`@texuli/document/schema` with `trust` set to the tier. Errors refuse;
warnings (orphaned comment anchors) do not.

```ts
import { validateDraft } from '@texuli/catalog/validate';
import { checkDocumentDraft } from '@texuli/pages/host';

const result = validateDraft(agentOutput, { catalog, checkDocument: checkDocumentDraft });
```
