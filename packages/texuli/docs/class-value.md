# `class` prop: Svelte 5 ClassValue

Styled Texuli roots accept Svelte’s `ClassValue` on `class` (string, nested
arrays, object maps), not only `string`.

```svelte
<Button class="w-full" />
<Button class={[full && 'w-full', className]} />
<Button class={{ 'w-full': full, 'opacity-50': disabled }} />
```

## Composition

- Import `cx` and `ClassValue` from `texuli/cx` (packages above texuli) or
  `packages/texuli/src/internal/cx.ts` inside texuli.
- `cx` flattens nested arrays, keeps object keys whose values are truthy, and
  skips falsy leftovers (`false`, `null`, `undefined`, `0`, `''`, `true`).
- Variant helpers merge the consumer `class` **last** so app classes win under
  `@layer tx.base, tx.components`.

## Tests

- Runtime: `packages/texuli/tests/internal-cx.test.ts`, `class-value.test.ts`
- Compile-time fixture: `packages/texuli/tests/fixtures/ClassValueHarness.svelte`
  (string / array with falsy / object map on Button, Badge, Card, Input)
