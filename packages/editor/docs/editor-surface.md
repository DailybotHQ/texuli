# Editor surface

`@texuli/editor/editor` exports `RichTextEditor`, `EditorSurface` and the DOM
selection mapping (`readDomSelection`, `writeDomSelection`, `domToPoint`,
`pointToDom`, `domBlockText`).

## RichTextEditor

The toolbar, the link dialog and the editing surface, wired to one
`EditorController`.

| Prop | Default | Meaning |
| --- | --- | --- |
| `value` | empty document | The document (from `loadEditorDocument` or `fromMarkdown`). A new value from outside restarts history |
| `onChange` | — | Every accepted change of the document |
| `controller` | created | Bring your own `EditorController` |
| `trust` | `'untrusted'` | URL policy tier for links typed in the link dialog. Pasted and autolinked URLs are always `untrusted` |
| `limits` | `EDITOR_LIMITS` | Lower caps (a blocks `text` field holds 4,000 characters) |
| `labels` | English | Partial `EditorLabels` to translate every string |
| `label` / `aria-labelledby` | `'Rich text'` | The textbox name. A placeholder is never the name |
| `placeholder` | — | Shown in an empty document |
| `readonly` | `false` | `aria-readonly="true"`, no toolbar, every edit refused |
| `toolbar` | `true` | Show the formatting toolbar |
| `resolveMedia` | — | `(ref) => { src, alt? }` for media blocks; `src` passes `safeImageSrc` at the untrusted tier, otherwise the block shows its alt text |

## EditorSurface

The bare `contenteditable` region (`role="textbox"`, `aria-multiline`), for
hosts that bring their own chrome. Props: `controller`, `label`,
`aria-labelledby`, `aria-describedby`, `placeholder`, `readonly`, `trust`,
`resolveMedia`, `onLinkRequest` (Mod+K). `focus()` focuses it and restores
the model selection.

## How input flows

- Every cancelable `beforeinput` is prevented and mapped by
  `intentFromInputType` to a controller command. `null` intents (for example
  `formatUnderline`) are refused.
- `keydown` runs the `editor-keymap` intents. Tab indents inside lists only;
  Escape arms a one-shot “Tab leaves”.
- `paste` reads the clipboard through `@texuli/editor/paste`. `drop` is
  refused for now.
- Composition: the browser owns the composing block's DOM until
  `compositionend`; then the controller diffs it (`applyComposition`) and the
  block re-renders from the model (a per-block epoch key). Non-cancelable
  inputs are diffed the same way on `input`.

## Selection mapping

Text blocks carry `data-tx-block`, void blocks `data-tx-void`, model breaks
`<br data-tx-break>` and caret fillers `<br data-tx-filler>` (zero length).
An offset counts UTF-16 units of the block's text nodes plus one per break,
the model's units; `data-tx-skip` subtrees (todo checkboxes) never count.
The model is written back to the DOM after each render while the surface is
focused and not composing.

## Long documents

Every block renders, keyed by id; unchanged blocks keep their identity, so a
keystroke re-renders only the changed block. Top-level blocks use
`content-visibility: auto` with an intrinsic size estimate. No perf limit
measures this yet.
