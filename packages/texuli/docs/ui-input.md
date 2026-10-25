# Components: Input, InputGroup and Textarea

**Package:** `texuli`  
**Path:** `packages/texuli/src/components/input/`  
**Task:** T-ui-input  
**Import:** `import { Input, InputGroup, Textarea, TextCounter } from 'texuli/input'`

Styled text fields on the token contract (`--tx-input`, `--tx-surface`,
`--tx-ring`, …). Logical CSS properties. No static `style=`.
Consumer classes compose through `cx` / `variants` and win by source order in
`@layer tx.components`.

## Exports

| Export | Role |
| --- | --- |
| `Input` | Native `<input>` with shared field chrome; optional clearable |
| `Textarea` | Native `<textarea>`; optional autosize |
| `InputGroup` | Flex shell with start/end adornment snippets + optional clear |
| `TextCounter` | Labelled field with remaining-character countdown |
| `autosizeTextarea` | Pure helper: set `block-size` from `scrollHeight` |
| `fieldVariants` | Shared class composer for standalone fields |

## Usage

```svelte
<script lang="ts">
  import { Input, InputGroup, Textarea, TextCounter } from 'texuli/input';
  let q = $state('');
</script>

<Input aria-label="Search" bind:value={q} clearable clearLabel="Clear search" />

<InputGroup bind:value={q} clearable clearLabel="Clear" inputProps={{ 'aria-label': 'Amount' }}>
  {#snippet start()}USD{/snippet}
</InputGroup>

<Textarea aria-label="Notes" autosize bind:value={q} />

<TextCounter label="Bio" maxlength={120} showAfter={30} bind:value={q} />
```

## States and a11y

- **Invalid:** `aria-invalid="true"` (Input/Textarea) or `invalid` on InputGroup.
- **Disabled / readonly:** native attributes; clear control hides when not editable.
- **Clear:** always named with `clearLabel` (translatable).
- **Character count:** `aria-live="polite"` region; visually shown near the limit while focused.
- **RTL:** padding and absolute count use logical properties (`inline-size`, `inset-inline-end`).

## Examples

Registry id `texuli-input` (`packages/examples/src/input/`): default, clearable,
invalid, disabled, group adornments, autosize, character count, RTL, dark.

## Testing

```bash
pnpm vitest run packages/texuli/tests/input.test.ts
pnpm vitest run packages/texuli/tests/internal-cx.test.ts packages/texuli/tests/variants-css.test.ts
```
