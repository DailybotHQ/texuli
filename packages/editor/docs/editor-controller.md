# Editor controller

`@texuli/editor/controller` exports `EditorController` (and
`createEditorController`), the headless editor over the core texels, plus
`DEFAULT_EDITOR_LABELS`. It holds no DOM.

```ts
import { EditorController } from '@texuli/editor/controller';

const editor = new EditorController({ doc, trust: 'untrusted', announce: (m) => {} });
editor.runInput('insert-text', 'Hi');
editor.runKey('toggle-strong');
editor.undo();
```

| Option | Meaning |
| --- | --- |
| `doc` | Starting document (validated by the caller) |
| `trust` | Tier for typed links. Default `untrusted` |
| `limits`, `newId` | Passed to every transform |
| `labels` | Partial `EditorLabels` |
| `announce` | Where announcements go (the surface passes the core announcer) |
| `onChange` | Every accepted document change, undo and redo included |
| `now` | Clock for undo grouping (tests) |

The options type is `EditorControllerOptions`.

Reactive state (Svelte runes): `history`, `state`, `doc`, `canUndo`,
`canRedo`, `active`, `composing`, `errors` (the last refusal). `active` is an
`EditorActiveState`: the `marks` at the selection, the `block` kind (an
`EditorBlockKind`: paragraph, heading with its level, code or a void block),
the `list` kind, whether it is in a `quote`, and the `link` href.
`EditorToggleMark` names the marks `toggleMark` takes (`strong`, `em`,
`strike`, `code`).

Commands: `runKey(intent)` and `runInput(intent, data)` for the keymap and
`beforeinput` intents (each returns whether it handled the event);
`toggleMark`, `setBlock`, `toggleList`, `toggleQuote`, `indent`, `outdent`,
`toggleTodo`, `toggleItem`, `insertDivider`, `setLink`, `removeLink`,
`insertText` (input rules apply as their own undo step), `paste(clipboard)`,
`select`, `replace`, `undo`, `redo`.

Composition guard: `compositionStart()` sets `composing`, and while it is
set `runInput` changes nothing. `compositionEnd(blockId, domText)` applies
the composed text as one typing step and bumps the block's epoch so the
surface re-renders it.

Refused edits never throw: the controller keeps the document, records
`errors` and announces a translatable reason (`labels.refused(code)`).
