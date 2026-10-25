# Editor toolbar

`@texuli/editor/toolbar` exports `EditorToolbar`, the formatting toolbar for
an `EditorController`, built on the `texuli/toolbar` component (one Tab stop,
arrow keys move, Home and End jump).

| Prop | Meaning |
| --- | --- |
| `controller` | The editor it drives |
| `onCommand` | Called after a command (and on Escape), so the host returns focus to the text |
| `onLinkRequest` | The Link button: open the link dialog |
| `disabled` | Disable every button |

Buttons, in three groups: bold, italic, strikethrough, inline code and link;
headings 1–3, bulleted, numbered and check lists, quote, code block and
divider; undo and redo. Toggle buttons expose `aria-pressed` from the
selection (`controller.active`); buttons with a chord expose
`aria-keyshortcuts` and show it in `title`. Unavailable buttons are
`aria-disabled` and stay focusable. Pressing a button with the pointer keeps
the text selection.
