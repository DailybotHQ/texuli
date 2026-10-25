# FileUpload

**Package:** `texuli`  
**Import:** `import { FileUpload } from 'texuli/file-upload'`  
**Tests:** `packages/texuli/tests/file-upload.test.ts`  
**Example:** `texuli-file-upload`

## Contract

Styled drop zone on `@texuli/primitives/file-drop`:

| Prop | Role |
| --- | --- |
| `files` / `rejects` | Bindable selection and rejection lists |
| `accept` / `maxSize` / `maxFiles` / `multiple` | Validation (metadata only) |
| `variant` | `default` \| `compact` |
| `showPreviews` | Image thumbnails via object URLs (revoked on change) |
| `progress` | Map of `name:size:lastModified` → 0–100 or `null` (indeterminate) |
| `status` | Optional per-file `pending` \| `uploading` \| `done` \| `error` |
| `labels` | Translatable chrome strings |

### Behavior

- Drag-and-drop and browse button share the same validation path
- Rejected files surface in a `role="alert"` list (from the primitive)
- Remove control per file
- Progress bars when `progress` / uploading status is set
- Styles in `@layer tx.components` with forced-colors borders

Contents are never opened except for optional image preview URLs.
