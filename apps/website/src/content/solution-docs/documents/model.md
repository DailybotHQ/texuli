## Document format

The canonical document is data: `format`, `formatVersion`, `meta`, optional `page`, `blocks` and `annotations`. Text blocks are the `@texuli/core` editor vocabulary (paragraph, heading 1–4, code, list, quote, divider, media) with `strong`, `em`, `strike`, `code` and `link` marks. Document blocks add callout, toggle, columns, nested pages, wrapped `@texuli/blocks` blocks and embeds (component, deck, sheet or canvas).

`loadUntrustedDocument` from `@texuli/document/schema` bounds work and validates at the untrusted tier.

```ts
import { loadUntrustedDocument } from '@texuli/document/schema';

const checked = loadUntrustedDocument(jsonText);
```

## Operations

`applyOperations` in `@texuli/document/ops` takes typed operations by persisted id with exact inverses. The op log is the single edit path: undo, redo, persistence and CRDT sync all replay it.

## Editor model

`@texuli/editor` owns the text surface. `RichTextEditor` takes a core editor document; Markdown in and out is `@texuli/editor/markdown`. Pages maps those text rows onto `@texuli/document` blocks.

```svelte
<script lang="ts">
  import { RichTextEditor } from '@texuli/editor/editor';
  import { documentToMarkdown, markdownToDocument } from '@texuli/editor/markdown';

  const { doc } = markdownToDocument('# Plan\n\n- [ ] Draft the **brief**');
</script>

<RichTextEditor value={doc} label="Notes" onChange={(next) => {}} />
```
