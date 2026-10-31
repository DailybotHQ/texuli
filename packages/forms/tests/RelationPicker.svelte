<script lang="ts">
import type { SchemaFormCustomField } from '../src/index.ts';

/* A host-registered custom field painter (a stand-in for a paged relation picker). */
let { field }: { field: SchemaFormCustomField } = $props();
</script>

<input
  {...field.props}
  data-relation-picker={field.kind}
  oninput={(event) => field.setValue((event.currentTarget as HTMLInputElement).value)}
/>
