<script lang="ts">
import { CodeField } from '../../src/code/code-field-entry.ts';

// A host that binds the field's value, the way `<CodeField bind:value />` is used.
let { initial = '', ...rest }: { initial?: string; [key: string]: unknown } = $props();
// svelte-ignore state_referenced_locally
let value = $state(initial);
</script>

<CodeField bind:value label="Snippet" {...rest} />
<output data-bound>{value}</output>
<button type="button" onclick={() => (value = 'let reset = 0;')}>Reset</button>
