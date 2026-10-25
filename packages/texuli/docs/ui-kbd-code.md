# Kbd, Code and CopyButton

**Package:** `texuli`  
**Import:** `import { Kbd, Code, CopyButton, copyText } from 'texuli/kbd-code'`  
**Tests:** `packages/texuli/tests/kbd-code.test.ts`  
**Example:** `texuli-kbd-code`

## Components

| Export | Role |
| --- | --- |
| `Kbd` | Keyboard key chrome (`<kbd>`) |
| `Code` | Inline or block monospaced text; **escaped only** (no HTML) |
| `CopyButton` | Copies plain text; shows copied/error feedback |
| `copyText` | Framework-free clipboard helper (testable) |

### Kbd

`label` (optional string) gives the key plain text without a snippet. It is
rendered as escaped text (never markup), and a non-empty `label` replaces
`children` when both are given; an empty or missing `label` keeps `children`.
Tested in `packages/texuli/tests/label-prop.test.ts`.

### Code

- `variant`: `inline` (default) or `block` (`<pre><code>`)
- `value`: plain string (preferred for untrusted content)
- `language`: optional `data-language` hint (display only)
- Children are allowed for author-controlled snippets; still rendered as text

### CopyButton

- `value` (required): string written to the clipboard
- `label` / `copiedLabel`: translatable idle and success labels
- `feedbackMs`: how long the copied state stays (default 1500)
- `size`: `sm` | `md`
- Uses `navigator.clipboard.writeText` with a textarea fallback
- `aria-live="polite"` announces label changes

### Class composition

Uses shared `cx` / `variants` from `packages/texuli/src/internal/`. Styles live in
`@layer tx.components` with logical properties and forced-colors borders.

## Example axes

`texuli-kbd-code`: kbd chords, inline/block code, HTML-as-text, copy, RTL, dark.
