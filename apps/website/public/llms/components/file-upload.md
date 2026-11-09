# FileUpload

> A labelled drop zone and file list for choosing local files.

- **id:** `file-upload`
- **package:** `texuli`
- **tier:** `app`
- **agent emittable:** no
- **emit:** 
- **group:** `forms`

### Use when

- The person attaches files to a form the host owns

### Don't use when

- Remote media the agent names as URLs (use media-image)

### Accessibility

- A real file input; the drop zone is named; rejected files are listed with a reason.

### Props

| Name | Kind | Required | Trust | Default | Description |
| --- | --- | --- | --- | --- | --- |
| `files` | array | no | — | — | Accepted files (bind:files) |
| `accept` | string | no | — | — | A native accept filter, e.g. image/* |
| `maxSize` | number | no | — | — | Largest file in bytes |
| `maxFiles` | number | no | — | — | — |
| `multiple` | boolean | no | — | `true` | — |
| `disabled` | boolean | no | — | `false` | — |
| `required` | boolean | no | — | `false` | — |
| `name` | string | no | — | — | — |
| `variant` | enum(default | compact) | no | — | `"default"` | — |
| `showPreviews` | boolean | no | — | `true` | — |
| `labels` | object | no | — | — | — |
| `onFilesAdd` | event | no | — | — | — |
| `onFileRemove` | event | no | — | — | — |
| `class` | string | no | — | — | — |

### Examples

#### Images (`images`)

```json
{
  "accept": "image/*",
  "multiple": true
}
```

### Related

- [`field`](field.md)
- [`form`](form.md)

---

_Generated from the Texuli catalog manifest. Do not hand-edit; regenerate with `@texuli/tools/llms`._
