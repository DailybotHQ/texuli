<script lang="ts">
import { SchemaForm } from '../src/index.ts';
import type { CompiledForm } from '../src/model/index.ts';
import { SCHEMA_FORM_CONTROLS } from '../src/view/controls/index.ts';

/* A host that turns disabled and readOnly off after mount, as an MFA form does when its challenge loads (G134). */
let { form }: { form: CompiledForm } = $props();
let disabled = $state(true);
let readOnly = $state(true);
</script>

<button type="button" onclick={() => (disabled = false)}>Enable</button>
<button type="button" onclick={() => (readOnly = false)}>Edit</button>
<SchemaForm {form} {disabled} {readOnly} controls={SCHEMA_FORM_CONTROLS} />
