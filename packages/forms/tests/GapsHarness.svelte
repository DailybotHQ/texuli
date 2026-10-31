<script lang="ts">
import {
  SchemaForm,
  type SchemaFormActions,
  type SchemaFormCustomField,
  type SchemaFormCustomFields,
} from '../src/index.ts';
import type { CompiledForm, FormController } from '../src/model/index.ts';

/*
 * Hosts for the forms gaps tests: a custom relation picker painted by a
 * `field` snippet (G113), a custom action row or none with an outside
 * submit button (G115), and the component instance for requestSubmit.
 */

let {
  form,
  mode = 'snippet',
  controller = null,
  onSubmit,
  validate,
  disabled = false,
}: {
  form: CompiledForm;
  mode?: 'snippet' | 'actions' | 'none';
  controller?: FormController | null;
  onSubmit?: (submission: { values: Record<string, unknown> }) => unknown;
  validate?: (value: unknown) => string | null | Promise<string | null>;
  disabled?: boolean;
} = $props();

let instance = $state<{ requestSubmit(): Promise<void> } | null>(null);
const customFields: SchemaFormCustomFields = {
  relation: { validate: (value) => validate?.(value) ?? null },
};
</script>

{#snippet picker(ctx: SchemaFormCustomField)}
  <input
    {...ctx.props}
    data-relation-picker={ctx.kind}
    data-entity={String(ctx.config.entity ?? '')}
    value={typeof ctx.value === 'object' && ctx.value !== null && 'id' in ctx.value ? String(ctx.value.id) : ''}
    oninput={(event) => ctx.setValue({ id: (event.currentTarget as HTMLInputElement).value })}
    onblur={() => ctx.blur()}
  />
{/snippet}

{#snippet row(actions: SchemaFormActions)}
  <button type="button" data-custom-submit onclick={() => void actions.submit()} disabled={actions.submitting}>
    {actions.last ? `Save (${actions.submitLabel})` : 'Continue'}
  </button>
{/snippet}

<SchemaForm
  bind:this={instance}
  {form}
  {controller}
  id="ticket"
  field={picker}
  {customFields}
  {disabled}
  actions={mode === 'actions' ? row : mode === 'none' ? false : undefined}
  onSubmit={onSubmit as never}
/>
<button type="submit" form="ticket" data-outside-submit>Outside submit</button>
<button type="button" data-request-submit onclick={() => void instance?.requestSubmit()}>Request submit</button>
