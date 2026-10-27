# File browser

> Folders and files in a grid or list with breadcrumbs, selection and type previews.

- **id:** `data-files`
- **package:** `@texuli/data`
- **tier:** `content`
- **agent emittable:** yes
- **emit:** developer, untrusted
- **group:** `data`

### Use when

- Show a folder structure people browse and select from

### Don't use when

- Uploading files: that is host chrome (file-upload)

### Accessibility

- A labelled grid or list with roving focus; folders open with Enter, Backspace goes up
- Selection is exposed per item; previews are decorative

### Props

| Name | Kind | Required | Trust | Default | Description |
| --- | --- | --- | --- | --- | --- |
| `label` | string | yes | untrusted | — | Accessible name of the view. |
| `entries` | array | yes | — | — | Files and folders; parent names the folder (none for the root). |
| `layout` | enum(grid | list) | no | — | `"grid"` | — |
| `density` | enum(comfortable | compact) | no | — | — | — |

### Examples

#### Shared drive (`shared`)

```json
{
  "label": "Shared drive",
  "entries": [
    {
      "id": "f1",
      "name": "Reports",
      "kind": "folder"
    },
    {
      "id": "f2",
      "name": "Q3 summary.pdf",
      "kind": "file",
      "parent": "f1",
      "type": "application/pdf",
      "size": 48213
    }
  ]
}
```

### Related

- [`data-tree-view`](data-tree-view.md)

---

_Generated from the Texuli catalog manifest. Do not hand-edit; regenerate with `@texuli/tools/llms`._
