# `@texuli/pages/collab`

The page editor on a collaborative session: comments anchored to the
text, suggestions with accept and reject, version history with restore,
and presence (remote carets and an accessible list of collaborators). It
runs on `@texuli/document/collab` (the owned CRDT of ADR-010, bound to the
document format of ADR-011) and keeps the editor's op log the single edit
path: local transactions become replica operations, merged changes come
back as `sync` entries of the log, and undo reverts only your own steps.

> **Status: in development.** Not on npm yet (first release planned for
> `0.7.0`).

Import it lazily, so only a collaborative page pays for it:

```svelte
<script lang="ts">
  import { createBroadcastChannelAdapter } from '@texuli/document/sync';
  import type { TexuliDocument } from '@texuli/document/model';

  let { doc }: { doc: TexuliDocument } = $props();
  const collab = import('@texuli/pages/collab');
</script>

{#await collab then { CollabEditor, createCollabSession }}
  <CollabEditor
    session={createCollabSession({
      replica: crypto.randomUUID().slice(0, 12),
      document: doc,
      author: { name: 'Ada', color: 3 },
      adapter: createBroadcastChannelAdapter('notes/42'),
    })}
  />
{/await}
```

Every replica of a document starts from the same document (or loads a
snapshot) and uses the same URL tier; see
[`@texuli/document/collab`](https://github.com/DailybotHQ/texuli/blob/main/packages/document/docs/collab.md).

## `CollabEditor`

`PageEditor` (from `@texuli/pages/editor`) with a review bar, the
collaborator list, decorations over the text and a sidebar.

| Prop | Default | What it does |
| --- | --- | --- |
| `session` | required | The `CollabSession` |
| `label` | document title | The editor region's accessible name |
| `labels` | English | Page editor strings (`PagesLabels`, partial) |
| `collabLabels` | English | Collaboration strings (`CollabLabels`, partial) |
| `readonly` | `false` | Read only (no review bar) |
| `trail`, `onNavigate`, `pageHref`, `createPage` | — | Nested pages, as on `PageEditor` |
| `resolveEmbed`, `resolveMedia`, `deckHost`, `components` | — | Embeds and media, as on `PageEditor` |
| `motion` | on | Layout motion, as on `PageEditor` |
| `editor` | created | Bindable `PagesEditor` |
| `history` | `false` | Bindable: show the version history panel |
| `announce` | `@texuli/core/announcer` | Polite announcements |
| `class` | — | Extra class on the root |

- **Review bar** (a labelled group of buttons): Comment (also
  Control+Alt+M, or Command+Option+M, from the text, with
  `aria-keyshortcuts`) opens the composer on the selected text, or on the
  block when the selection is a caret; Suggesting is a toggle button
  (`aria-pressed`) that turns your text edits into suggestions; Version
  history is a disclosure (`aria-expanded`) for the history panel.
- **Decorations** (`CollabOverlay`): open comment ranges, the active
  thread, suggested insertions (underlined) and deletions (struck) and
  remote selections are painted with the CSS Custom Highlight API
  (`::highlight()`), so the editor's DOM is never changed and nothing
  reaches the accessibility tree; remote carets with name flags are
  `aria-hidden`. Where `::highlight()` is not supported the text is not
  painted and the sidebar remains the full view.
- **Sidebar** (`aside`): `CommentSidebar`, `SuggestionList` and, when
  open, `VersionHistory`.

## Parts

- **`CommentSidebar`** (`session`, bindable `draft` as a `CommentDraft`,
  `labels`, `onShow`, `announce`, `onCancel`): the composer and every
  thread as an article of a WAI-ARIA feed (`role="feed"`; Page Down and
  Page Up move between threads, Control+End and Control+Home leave the
  feed). Each thread shows its author and quoted text (or that the text was
  deleted, for an orphaned thread), its messages with `@{id|label}`
  mentions as text, a reply form, Resolve or Reopen, Show in text and
  Delete thread. Focusing a thread makes it the active highlight.
- **`SuggestionList`** (`session`, `labels`, `announce`): pending
  suggestions as a feed, each with its author, its changes ("Insert …",
  "Delete …") and Accept and Reject; Accept all and Reject all.
- **`VersionHistory`** (`session`, `labels`, `announce`): save the current
  state under a name, the versions newest first, a disclosure listing the
  changes since each, and Restore (new operations: it reaches everyone and
  one undo reverts it).
- **`CollaboratorList`** (`session`, `labels`): you and every live
  collaborator, with the block their caret is in; color swatches are
  `aria-hidden`.
- **`CollabOverlay`** (`session`, `root`): the decorations, positioned in
  `root` (a positioned element around the editor).
- `feedKeydown(event, feed)` and `feedArticles(feed)`: the feed keyboard,
  for hosts that build their own lists.

## Session

`createCollabSession(options)` returns a `CollabSession`
(`CollabSessionOptions`: every `DocumentSyncOptions` field plus an optional
`adapter` to connect at once). Reactive fields: `document`, `threads`,
`suggestions`, `versions`, `collaborators`, `activeThread`, `revision`;
`suggesting` switches suggestion mode; `replica` and `author`.

- `bind(editor)` puts a `PagesEditor` on the session (its document, new
  block ids prefixed with the replica id, `connectSync`); `CollabEditor`
  calls it. It returns the unbind function.
- `addComment`, `reply`, `resolve`, `reopen`, `deleteComment`, `accept`,
  `reject`, `acceptAll`, `rejectAll`, `saveVersion`, `restoreVersion`,
  `compare`, `setSelection` and `close` forward to the `DocumentSync`
  (`sync`).
- `ranges()` returns the `CollabRange`s the overlay paints (open comments
  and suggestion changes).
- `presenceColor(index)` maps a presence color index to a token:
  `var(--tx-chart-1)` to `var(--tx-chart-8)` (indices 8 to 11 reuse them;
  the name flag tells collaborators apart).

## Highlights

`HIGHLIGHT_NAMES` lists the highlight names (`tx-pages-comment`,
`tx-pages-comment-active`, `tx-pages-suggest-insert`,
`tx-pages-suggest-delete`, and `tx-pages-remote-1` to `-8`); style them with
`::highlight(<name>)`. `HighlightLayer` adds and removes one editor's
ranges (several editors share the page's highlights), `rangeFor(root,
block, from, to)` builds a DOM range from UTF-16 offsets, `blockElement`
finds a block's text element, and `supportsHighlights()` reports support.

## Labels

`DEFAULT_COLLAB_LABELS` holds every string (`CollabLabels`);
`resolveCollabLabels(overrides)` merges partial overrides (empty strings
never replace a default).

## Styles

The parts import `collab.css` (tokens only, logical properties; forced
colors use `Mark`, `Highlight` and system colors). Class hooks:
`.tx-pages-collab` (root, `data-suggesting` while suggesting),
`.tx-pages-collab__bar`, `.tx-pages-collab__tools`,
`.tx-pages-collab__body`, `.tx-pages-collab__doc`,
`.tx-pages-collab__overlay`, `.tx-pages-collab__caret`,
`.tx-pages-collab__caret-name`, `.tx-pages-collab__sidebar`,
`.tx-pages-collab__panel`, `.tx-pages-collab__heading`,
`.tx-pages-collab__feed`, `.tx-pages-collab__thread` (`data-status`,
`data-active`, `data-orphaned`), `.tx-pages-collab__suggestion`,
`.tx-pages-collab__composer`, `.tx-pages-collab__reply`,
`.tx-pages-collab__messages`, `.tx-pages-collab__message`,
`.tx-pages-collab__text`,
`.tx-pages-collab__mention`, `.tx-pages-collab__versions`,
`.tx-pages-collab__version`, `.tx-pages-collab__diff`,
`.tx-pages-collab__changes`, `.tx-pages-collab__change` (`data-kind`),
`.tx-pages-collab__people`, `.tx-pages-collab__person` and
`.tx-pages-collab__swatch`. `--tx-pages-caret-color` colors a caret.

## Not done yet

- Suggestions track text insertions and deletions; block structure and
  formatting changes apply directly while suggesting.
- Comments on a selection that spans several blocks become a comment on the
  block of the caret.
- Mentions render from `@{id|label}` text; a people picker in the composer
  is planned.
- Network transports and persistence (WebSocket, IndexedDB, a server) are
  host `SyncAdapter`s.
