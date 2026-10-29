<script lang="ts">
import { SchemaForm } from '@texuli/forms';
import { validateFormSchema } from '@texuli/forms/model';
import { REGISTRATION_SCHEMA } from './schemas.ts';

const result = validateFormSchema(REGISTRATION_SCHEMA);
let sent = $state('');
</script>

<section data-example="forms-registration" class="demo" aria-label="Schema form registration">
  {#if result.ok}
    <SchemaForm
      form={result.form}
      values={{ arrival: '2026-11-10', departure: '2026-11-12' }}
      onSubmit={({ values }) => {
        sent = JSON.stringify(values, null, 2);
      }}
    />
  {/if}
  {#if sent}
    <pre class="sent" aria-label="Submitted values">{sent}</pre>
  {/if}
</section>

<style>
  .demo {
    display: grid;
    gap: 1rem;
    padding: 1.5rem;
    min-block-size: 32rem;
    color: var(--tx-foreground, CanvasText);
    background: var(--tx-background, Canvas);
  }
  .sent {
    margin: 0;
    padding: 0.75rem;
    font-size: 0.8125rem;
    border: 1px solid var(--tx-border, CanvasText);
    border-radius: var(--tx-radius-sm, 0.375rem);
  }
</style>
