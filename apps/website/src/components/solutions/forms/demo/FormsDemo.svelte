<script lang="ts">
import { createMemoryDrafts, SchemaForm } from '@texuli/forms';
import { FormBuilder } from '@texuli/forms/builder';
import { type FormSchema, validateFormSchema } from '@texuli/forms/model';

const INTAKE_SCHEMA: FormSchema = {
  title: 'Community workshop request',
  description: 'A fictional example.com event. Nothing is submitted or stored on a server.',
  submitLabel: 'Finish preview',
  steps: [
    {
      id: 'about',
      title: 'About you',
      description: 'Share a few details for the workshop team.',
      fields: [
        { name: 'name', type: 'text', label: 'Your name', required: true, autocomplete: 'name' },
        {
          name: 'email',
          type: 'email',
          label: 'Email address',
          required: true,
          autocomplete: 'email',
        },
        {
          name: 'format',
          type: 'select',
          label: 'How will you join?',
          required: true,
          default: 'remote',
          options: [
            { value: 'remote', label: 'Online' },
            { value: 'in-person', label: 'In person' },
          ],
        },
      ],
    },
    {
      id: 'visit',
      title: 'Plan your visit',
      description: 'This step appears when you choose to join in person.',
      when: {
        show: {
          op: 'eq',
          left: { op: 'field', name: 'format' },
          right: { op: 'str', value: 'in-person' },
        },
      },
      fields: [
        { name: 'arrival', type: 'date', label: 'Arrival date', required: true },
        {
          name: 'dietary',
          type: 'text',
          label: 'Dietary needs',
          placeholder: 'Optional',
          when: {
            show: { op: 'neq', left: { op: 'field', name: 'arrival' }, right: { op: 'null' } },
          },
        },
      ],
    },
    {
      id: 'follow-up',
      title: 'Stay in the loop',
      fields: [
        { name: 'updates', type: 'checkbox', label: 'Email me about future example.com workshops' },
      ],
    },
  ],
};

const compiled = validateFormSchema(INTAKE_SCHEMA, { tier: 'developer' });
const drafts = {
  storage: createMemoryDrafts(),
  key: 'community-workshop-preview',
  debounceMs: 150,
};
const BUILDER_SCHEMA: FormSchema = {
  title: 'Workshop contact form',
  fields: [
    { name: 'name', type: 'text', label: 'Your name', required: true },
    { name: 'email', type: 'email', label: 'Email address', required: true },
  ],
};
let builderSchema = $state<FormSchema>(BUILDER_SCHEMA);
let submission = $state('');
let announcement = $state(
  'The sample form is ready. Drafts remain in memory for this page session.'
);

function finishPreview(): { ok: true } {
  submission = 'Preview complete. No response was sent.';
  return { ok: true };
}
</script>

<section class="forms-demo" data-tx-forms-demo data-demo-live aria-label="Forms builder and runtime preview">
  <div class="forms-demo__notice">
    <p>Interactive preview</p>
    <span>Fictional data · in-memory drafts · no network submission</span>
  </div>
  <div class="forms-demo__runtime">
    <div class="forms-demo__section-heading">
      <div>
        <h3>Fill the workshop intake</h3>
        <p>Choose “In person” to reveal the visit step. Edit a field to exercise local autosave.</p>
      </div>
      <span class="forms-demo__badge">SchemaForm</span>
    </div>
    {#if compiled.ok}
      <SchemaForm
        form={compiled.form}
        {drafts}
        onValueChange={() => { announcement = 'Draft updated in this page session.'; }}
        onSubmit={finishPreview}
      />
    {:else}
      <p role="alert">The example form schema could not be validated.</p>
    {/if}
    <p class="forms-demo__status" role="status" aria-live="polite">{announcement}</p>
    {#if submission}<p class="forms-demo__submitted" role="status">{submission}</p>{/if}
  </div>

  <details class="forms-demo__builder">
    <summary>Open the visual builder</summary>
    <p class="forms-demo__builder-note">The builder was released in @texuli/forms 0.18.0 (in development, pre-1.0).</p>
    <FormBuilder schema={builderSchema} onChange={(schema) => { builderSchema = schema; }} />
    <p class="forms-demo__json-note" aria-live="polite">{builderSchema.fields?.length ?? 0} fields in the authored schema.</p>
    <p class="forms-demo__json-note">Builder output updates its validated preview and schema JSON as you edit.</p>
  </details>
</section>

<style>
  .forms-demo { display: grid; gap: 1.25rem; min-inline-size: 0; color: var(--tx-foreground, CanvasText); }
  .forms-demo__notice { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: .5rem; padding: .75rem 1rem; border: 1px solid var(--tx-border, ButtonBorder); border-radius: .75rem; background: var(--tx-muted, Canvas); font-size: .875rem; }
  .forms-demo__notice p { margin: 0; font-weight: 700; }
  .forms-demo__notice span, .forms-demo__status, .forms-demo__builder-note, .forms-demo__json-note, .forms-demo__section-heading p { color: var(--tx-muted-foreground, GrayText); }
  .forms-demo__runtime, .forms-demo__builder { min-inline-size: 0; padding: clamp(.85rem, 3vw, 1.5rem); border: 1px solid var(--tx-border, ButtonBorder); border-radius: 1rem; background: var(--tx-background, Canvas); }
  .forms-demo__section-heading { display: flex; flex-wrap: wrap; align-items: start; justify-content: space-between; gap: .75rem; margin-block-end: 1.25rem; }
  .forms-demo__section-heading h3 { margin: 0; font-size: 1.2rem; }
  .forms-demo__section-heading p { margin: .35rem 0 0; font-size: .9rem; }
  .forms-demo__badge { padding: .3rem .65rem; border: 1px solid var(--tx-border, ButtonBorder); border-radius: 99px; font-size: .8rem; font-weight: 650; }
  .forms-demo__status, .forms-demo__submitted { min-block-size: 1.25em; margin-block: .5rem 0; font-size: .875rem; }
  .forms-demo__builder summary { cursor: pointer; min-block-size: 2.75rem; display: flex; align-items: center; font-weight: 700; }
  .forms-demo__builder-note, .forms-demo__json-note { font-size: .875rem; line-height: 1.5; }
  .forms-demo__builder-note { margin-block: .5rem 1rem; }
  .forms-demo__json-note { margin-block-end: 0; }
  @media (forced-colors: active) { .forms-demo__runtime, .forms-demo__builder, .forms-demo__notice, .forms-demo__badge { border-color: CanvasText; } }
</style>
