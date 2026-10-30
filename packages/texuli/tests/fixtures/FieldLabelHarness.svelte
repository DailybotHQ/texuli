<script lang="ts">
import { Field } from '../../src/components/field/index.ts';
import FieldLabelGroup from './FieldLabelGroup.svelte';
</script>

<Field label="Priority">
  {#snippet children()}
    <FieldLabelGroup />
  {/snippet}
</Field>
<div data-testid="outside"><FieldLabelGroup /></div>
