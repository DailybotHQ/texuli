<script lang="ts">
import { SchemaForm } from '@texuli/forms';
import { validateFormSchema } from '@texuli/forms/model';
import { FIELDS_SCHEMA } from './schemas.ts';

const result = validateFormSchema(FIELDS_SCHEMA);
</script>

<section data-example="forms-fields" class="demo" aria-label="Schema form field types">
  {#if result.ok}
    <SchemaForm
      form={result.form}
      values={{ title: 'Harbor Notes', workspace: 'lumen', shared: ['harbor'], plan: 'team', priority: 6, labels: ['launch'] }}
    />
  {/if}
</section>

<style>
  .demo {
    padding: 1.5rem;
    min-block-size: 40rem;
    color: var(--tx-foreground, CanvasText);
    background: var(--tx-background, Canvas);
  }
</style>
