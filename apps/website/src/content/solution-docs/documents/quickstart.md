## Install

`@texuli/document` has no peer dependencies. `@texuli/pages` and `@texuli/editor` need Svelte 5 (`^5.57.2`).

```bash
npm install @texuli/pages @texuli/document @texuli/tokens
```

Import the token stylesheet once. The editor and reader import their own CSS.

```ts
import '@texuli/tokens/base.css';
```

## Create and edit a document

Every entry point is total: it never throws on hostile input.

```ts
import { createDocument, paragraphBlock } from '@texuli/document/model';
import { applyOperations } from '@texuli/document/ops';
import { documentToMarkdown } from '@texuli/document/markdown';

const doc = createDocument({
  meta: { title: 'Release notes' },
  blocks: [paragraphBlock('p1', 'Shipped the new editor.')],
});

const edit = applyOperations(doc, [
  { op: 'insert-text', id: 'p1', offset: 0, text: 'Today: ' },
]);
if (edit.ok) {
  console.log(documentToMarkdown(edit.document));
}
```

## Put it on the page

Keep the document in `$state.raw`. Validate untrusted JSON first.

```svelte
<script lang="ts">
  import { loadUntrustedDocument } from '@texuli/document/schema';
  import { PageEditor } from '@texuli/pages/editor';
  import { PageReader } from '@texuli/pages/reader';
  import '@texuli/tokens/base.css';

  let { json }: { json: string } = $props();
  const loaded = loadUntrustedDocument(json);
  let doc = $state.raw(loaded.ok ? loaded.document : null);
</script>

{#if doc}
  <PageEditor document={doc} onChange={(next) => (doc = next)} />
  <PageReader document={doc} />
{/if}
```
