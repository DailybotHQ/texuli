<script lang="ts">
/**
 * /whats-new/ forms demo: a two-field `SchemaForm` from `@texuli/forms`,
 * validated as a schema first; submitting shows the typed values. Errors
 * are announced and focus moves to the first one.
 */
import { SchemaForm } from '@texuli/forms';
import { type FormSchema, validateFormSchema } from '@texuli/forms/model';

const schema: FormSchema = {
  title: 'Join the beta',
  submitLabel: 'Request access',
  fields: [
    { name: 'email', type: 'email', label: 'Work email', required: true },
    {
      name: 'seats',
      type: 'number',
      label: 'Seats',
      required: true,
      min: 1,
      max: 50,
    },
  ],
};
const result = validateFormSchema(schema);
let sent = $state('');
</script>

<div class="hub-demo" data-hub-demo="forms">
  {#if result.ok}
    <SchemaForm
      form={result.form}
      headingLevel={4}
      onSubmit={({ values }) => {
        sent = JSON.stringify(values);
        return { ok: true };
      }}
    />
  {/if}
  <p class="hub-demo__out" role="status" data-hub-form-sent="">{sent ? `Sent ${sent}` : ''}</p>
</div>
