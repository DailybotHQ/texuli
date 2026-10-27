# Content block parser

`parseTexuliBlocks(value)` is exported from `@texuli/astro` and
`@texuli/astro/content`. It accepts `unknown` data and validates it through
`safeParseBlocks` from `@texuli/blocks/core`.

```ts
import { parseTexuliBlocks } from '@texuli/astro/content';

const result = parseTexuliBlocks([
  { type: 'heading', level: 1, text: 'Welcome' },
  { type: 'text', text: 'A short introduction.' },
]);

if (result.success) {
  for (const block of result.blocks) console.log(block.type);
} else {
  console.error(result.issues);
}
```

The return value is a discriminated union:

- `{ success: true, blocks: Block[] }` contains the validated block data.
- `{ success: false, issues: FieldIssue[] }` contains schema issues for
  rejected input.

An object that is not a block array, malformed entries, and unknown block
types are rejected. The parser does not coerce strings to markup, render
blocks, or accept a raw-HTML block. Use the block-family renderers from
`@texuli/blocks` when you need rendering, and follow that package's trust
contract for the source data.

This helper is suitable at a content boundary, such as validating a field from
a loaded Astro content entry before passing it to application code. It does
not replace source-specific authorization or provide a content collection
loader.

## Tests

`packages/astro/tests/astro.test.ts` covers a valid heading block and rejects
an unknown raw-HTML type and a non-array value.
