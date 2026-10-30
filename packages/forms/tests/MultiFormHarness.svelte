<script lang="ts">
import { SchemaForm } from '../src/index.ts';
import type { CompiledForm } from '../src/model/index.ts';

let { first, second }: { first: CompiledForm; second: CompiledForm } = $props();
</script>

<main>
  <SchemaForm form={first} id="first" />
  <SchemaForm form={second} id="second" />
</main>
