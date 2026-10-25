# Link dialog

`@texuli/editor/link-dialog` exports `LinkDialog`, a non-modal dialog
(`role="dialog"`, named “Edit link”) that edits the link at the selection.

| Prop | Meaning |
| --- | --- |
| `controller` | The editor whose selection it links |
| `onClose` | Called after Apply, Remove or Cancel, and on Escape |

- The address field starts with the link at the selection, if any. At a caret
  outside a link, a “Link text” field appears and the text is inserted as the
  link.
- **Apply** calls `controller.setLink`, which checks the address with
  `safeHref` at the editor's `trust` (`untrusted` by default: `https:`,
  `mailto:` and `#` fragments). A refused address keeps the dialog open,
  marks the field `aria-invalid` with a visible message, and announces the
  refusal; the document does not change.
- An empty address removes the link. **Remove link** shows when the
  selection is in a link.
