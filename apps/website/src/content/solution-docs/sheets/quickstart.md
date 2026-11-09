## Install

Svelte 5 (`^5.57.2`) is a peer of `@texuli/sheets`. Import `@texuli/tokens/base.css` once.

```bash
npm install @texuli/sheets
```

## Load and show a sheet

Sheets from a file, an agent or a share link go through `loadUntrustedSheet` first.

```svelte
<script lang="ts">
  import { loadUntrustedSheet } from '@texuli/sheets/model';
  import { SheetView } from '@texuli/sheets/view';
  import '@texuli/tokens/base.css';

  let { json }: { json: string } = $props();
  const loaded = loadUntrustedSheet(json);
  let sheet = $state(loaded.ok ? loaded.sheet : null);
</script>

{#if sheet}
  <SheetView bind:sheet now={() => Date.now()} />
{/if}
```

## Drive the workbook

```ts
import { createWorkbook, displayValue, loadUntrustedSheet } from '@texuli/sheets/model';

const loaded = loadUntrustedSheet(json);
if (loaded.ok) {
  const workbook = createWorkbook(loaded.sheet, { now: () => Date.now() });
  workbook.setInput('costs', 0, 1, 150);
  displayValue(workbook.value('costs', 2, 1));
  const next = workbook.toDocument();
}
```
