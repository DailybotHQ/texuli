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

## Values, handlers and refs

- **Caller handlers compose (G26).** An `oninput` you pass never replaces the
  internal one: the field updates `value` first (so `bind:value` keeps
  working), then your handler runs and already sees the new value. The same
  holds for `Textarea`, `InputGroup` (`inputProps.oninput`) and `TextCounter`.
- **Numbers (G44).** With `type="number"` or `type="range"`, `bind:value`
  binds a number, and `null` while the field is empty (`Input` takes
  `value?: string | number | null`). `onValueChange` still receives the
  field's text. The clear control resets a numeric field to `null`.
- **Files (G38).** With `type="file"`, `bind:files` is `null` until the user
  picks files (an empty pick is `null` too). Setting `files = null` resets the
  input. A `null` is never written onto the element, so `input.value` stays
  readable (axe in unit tests).
- **TextCounter ref and attributes (G5).** `bind:ref` binds the wrapper root.
  `aria-*`, `data-*` and handlers reach the input or textarea; layout hooks
  (`style`, `hidden`…) stay on the wrapper, like every styled form control
  ([control-props](control-props.md)).

```svelte
<Input type="number" aria-label="Seats" bind:value={seats} oninput={track} />
<Input type="file" aria-label="Attachment" bind:files />
<button type="button" onclick={() => (files = null)}>Remove file</button>
```

## Examples

Registry id `texuli-input` (`packages/examples/src/input/`): default, clearable,
invalid, disabled, group adornments, autosize, character count, RTL.

## Testing

```bash
pnpm vitest run packages/texuli/tests/forms.test.ts
pnpm vitest run packages/texuli/tests/contracts.test.ts
```
