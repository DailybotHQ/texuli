# CommandPalette

> Dialog-hosted command palette with search and recent items.

- **id:** `command-palette`
- **package:** `texuli`
- **tier:** `app`
- **agent emittable:** no
- **emit:** 
- **group:** `overlays`

### Use when

- App-wide jump-to and actions (⌘K)

### Don't use when

- Simple select lists (use select or combobox)

### Accessibility

- Dialog title/description; listbox keyboard for results.

### Props

| Name | Kind | Required | Trust | Default | Description |
| --- | --- | --- | --- | --- | --- |
| `open` | boolean | no | — | `false` | — |
| `onOpenChange` | event | no | — | — | — |
| `search` | unknown | no | — | — | Sync or async search function |
| `onSelect` | event | no | — | — | — |
| `recentItems` | array | no | — | — | — |
| `debounceMs` | number | no | — | — | — |
| `placeholder` | string | no | — | — | — |
| `shortcut` | boolean | no | — | `true` | — |
| `recentLabel` | string | no | — | — | — |
| `title` | string | no | — | — | — |
| `description` | string | no | — | — | — |
| `emptyLabel` | string | no | — | — | — |
| `recentEmptyLabel` | string | no | — | — | — |
| `loadingLabel` | string | no | — | — | — |
| `errorLabel` | string | no | — | — | — |
| `size` | enum(sm | md | lg) | no | — | `"md"` | — |
| `variant` | enum(outline | soft) | no | — | `"default"` | — |
| `class` | string | no | — | — | — |

### Examples

#### Open palette (`palette`)

```json
{
  "open": true,
  "title": "Command palette",
  "placeholder": "Search…"
}
```

### Related

- [`dialog`](dialog.md)
- [`dropdown-menu`](dropdown-menu.md)

---

_Generated from the Texuli catalog manifest. Do not hand-edit; regenerate with `@texuli/tools/llms`._
