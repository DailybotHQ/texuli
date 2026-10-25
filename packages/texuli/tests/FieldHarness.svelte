<script lang="ts">
import { Button } from '../src/components/button/index.ts';
import { Field, type FieldErrorMap, Form } from '../src/components/field/index.ts';
import { Input } from '../src/components/input/index.ts';

interface Props {
  mode?: 'field' | 'form';
  label?: string;
  description?: string;
  error?: string | null;
  required?: boolean;
  hideLabel?: boolean;
  onValidate?: (values: Record<string, string>) => FieldErrorMap | Promise<FieldErrorMap>;
  onSubmitValues?: (values: Record<string, string>) => void;
  /** Keep the browser's constraint validation on (the Form default). */
  nativeValidation?: boolean;
}

let {
  mode = 'field',
  label = 'Work email',
  description,
  error = null,
  required = false,
  hideLabel = false,
  onValidate,
  onSubmitValues,
  nativeValidation = false,
}: Props = $props();

let value = $state('');
let errors = $state<FieldErrorMap>({});
</script>

{#if mode === 'form'}
  <Form bind:errors noValidate={!nativeValidation} {onValidate} {onSubmitValues}>
    <Field label="Email" error={errors.email} required>
      {#snippet children(control)}
        <Input {...control.props} name="email" bind:value type="email" autocomplete="email" />
      {/snippet}
    </Field>
    <div class="tx-form__actions">
      <Button type="submit">Save</Button>
    </div>
  </Form>
{:else}
  <Field {label} {description} {error} {required} {hideLabel}>
    {#snippet children(control)}
      <Input {...control.props} bind:value />
    {/snippet}
  </Field>
{/if}
