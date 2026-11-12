## Block-type menu

Pass `blockMenu` to `RichTextEditor` or `EditorToolbar`, or use `BlockTypeMenu` from `@texuli/editor/block-menu`. In development: released in `0.18.0`.

- It follows the APG menu button pattern: the button names the current kind, and the menu holds item radios for paragraph, headings 1 to 4, bulleted, numbered and check lists, quote and code block.
- Enter, Space and Down Arrow open it on the first item, Up Arrow on the last; Escape closes it and returns focus.
- A choice is one undo step and is announced. A plain block leaves the lists and the quote around the caret.

```svelte
<RichTextEditor value={doc} blockMenu label="Release notes" />
```
