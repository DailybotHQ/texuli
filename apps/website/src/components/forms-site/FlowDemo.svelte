<script lang="ts">
/**
 * /forms-page/ multi-step flow: FLOW_SCHEMA in `SchemaForm` (a Stepper,
 * per-step validation, focus and announcements on each step), and beside
 * it the logic the form computes from the answers so far
 * (`computeFormLogic`): every condition in its text form and, live,
 * whether each field shows, is required and is editable, and which steps
 * run. A hidden or disabled field is neither validated nor submitted.
 */
import { SchemaForm } from '@texuli/forms';
import {
  computeFormLogic,
  type FormLogicState,
  type FormValues,
  validateFormSchema,
} from '@texuli/forms/model';
import { onMount } from 'svelte';
import { conditionText, FLOW_SCHEMA } from './schemas.ts';

const result = validateFormSchema(FLOW_SCHEMA);
const form = result.ok ? result.form : null;
let logic = $state.raw<FormLogicState | null>(form ? computeFormLogic(form, {}) : null);
let round = $state(0);
let sent = $state('');
// SchemaForm paints after mount: texuli's Select.Value recurses when it renders on the
// server (reported to the lead), and these forms hold select fields.
let mounted = $state(false);
onMount(() => {
  mounted = true;
});

const conditional = form
  ? form.fields
      .filter((field) => field.field.when)
      .map((field) => ({
        name: field.field.name,
        label: field.field.label,
        show: conditionText(field.field.when?.show),
        require: conditionText(field.field.when?.require),
        enable: conditionText(field.field.when?.enable),
      }))
  : [];
const steps = FLOW_SCHEMA.steps ?? [];
const rules = FLOW_SCHEMA.rules ?? [];

function update(values: FormValues): void {
  if (form) logic = computeFormLogic(form, values);
}

function yesNo(value: boolean | undefined): string {
  return value ? 'yes' : 'no';
}
</script>

<div class="flow" data-forms-flow="">
  <div class="flow__form">
    {#key round}
      {#if !mounted}
        <p data-forms-pending="">Preparing the form…</p>
      {:else if form}
        <SchemaForm
          {form}
          headingLevel={3}
          labels={{ progress: 'Pilot request progress' }}
          onValueChange={(_name, _value, values) => update(values)}
          onSubmit={({ values }) => {
            sent = JSON.stringify(values, null, 2);
            return { ok: true };
          }}
        />
      {:else}
        <p role="alert">The flow schema did not validate.</p>
      {/if}
    {/key}
    <button
      type="button"
      class="flow__button"
      onclick={() => {
        round += 1;
        sent = '';
        if (form) logic = computeFormLogic(form, {});
      }}>Start the flow over</button
    >
    {#if sent}
      <pre class="flow__json" aria-label="Submitted values" tabindex="0" data-forms-flow-sent="">{sent}</pre>
    {/if}
  </div>
  <div class="flow__logic" data-forms-logic="">
    <h3 class="flow__title">Steps</h3>
    <ol class="flow__steps">
      {#each steps as step, index (step.id)}
        <li data-forms-logic-step={step.id} data-runs={yesNo(logic?.steps[index])}>
          <strong>{step.title}</strong>
          {#if step.when?.show}
            <span>shows when <code>{conditionText(step.when.show)}</code></span>
          {/if}
          <span class="flow__state">{logic?.steps[index] ? 'runs' : 'skipped'}</span>
        </li>
      {/each}
    </ol>
    <div class="flow__scroll" role="region" aria-label="Conditional fields" tabindex="0">
      <table class="flow__table">
        <caption>Conditional fields, live</caption>
        <thead>
          <tr>
            <th scope="col">Field</th>
            <th scope="col">Conditions</th>
            <th scope="col">Shown</th>
            <th scope="col">Required</th>
            <th scope="col">Editable</th>
          </tr>
        </thead>
        <tbody>
          {#each conditional as row (row.name)}
            {@const state = logic?.fields[row.name]}
            <tr data-forms-logic-field={row.name}>
              <th scope="row">{row.label}</th>
              <td>
                {#if row.show}<div>show: <code>{row.show}</code></div>{/if}
                {#if row.require}<div>require: <code>{row.require}</code></div>{/if}
                {#if row.enable}<div>enable: <code>{row.enable}</code></div>{/if}
              </td>
              <td data-cell="visible">{yesNo(state?.visible)}</td>
              <td data-cell="required">{yesNo(state?.required)}</td>
              <td data-cell="enabled">{yesNo(state?.enabled)}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
    <h3 class="flow__title">Cross-field rules</h3>
    <ul class="flow__rules">
      {#each rules as rule (rule.id)}
        <li><code>{conditionText(rule.test)}</code>, or: “{rule.message}”</li>
      {/each}
    </ul>
  </div>
</div>

<style>
  .flow {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 22rem), 1fr));
    gap: 1rem;
    align-items: start;
    padding: clamp(0.75rem, 2vw, 1.25rem);
    border: 1px solid var(--tx-border, CanvasText);
    border-radius: 1rem;
    background: var(--tx-surface, Canvas);
    color: var(--tx-foreground, CanvasText);
  }
  .flow__form,
  .flow__logic {
    display: grid;
    gap: 0.75rem;
    min-inline-size: 0;
  }
  .flow__title {
    margin: 0;
    font-size: 1rem;
  }
  .flow__steps {
    display: grid;
    gap: 0.4rem;
    margin: 0;
    padding-inline-start: 1.25rem;
    font-size: 0.875rem;
  }
  .flow__steps li {
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem 0.6rem;
  }
  .flow__state {
    padding-inline: 0.45rem;
    border: 1px solid var(--tx-border, CanvasText);
    border-radius: 999px;
    font-size: 0.75rem;
  }
  [data-runs='no'] {
    color: var(--tx-muted-foreground, GrayText);
  }
  .flow__scroll {
    overflow-x: auto;
  }
  .flow__scroll:focus-visible,
  .flow__json:focus-visible,
  .flow__button:focus-visible {
    outline: 2px solid var(--tx-ring, Highlight);
    outline-offset: 2px;
  }
  .flow__table {
    inline-size: 100%;
    border-collapse: collapse;
    font-size: 0.8125rem;
  }
  .flow__table caption {
    padding-block-end: 0.4rem;
    text-align: start;
    font-weight: 600;
  }
  .flow__table th,
  .flow__table td {
    padding: 0.35rem 0.45rem;
    border-block-end: 1px solid var(--tx-border, CanvasText);
    text-align: start;
    vertical-align: top;
  }
  .flow__rules {
    margin: 0;
    padding-inline-start: 1.25rem;
    font-size: 0.875rem;
  }
  .flow__button {
    justify-self: start;
    min-block-size: 2.25rem;
    padding-inline: 0.8rem;
    border: 1px solid var(--tx-border, ButtonBorder);
    border-radius: 0.5rem;
    background: var(--tx-background, ButtonFace);
    color: var(--tx-foreground, ButtonText);
    font: inherit;
    cursor: pointer;
  }
  .flow__json {
    margin: 0;
    max-block-size: 18rem;
    padding: 0.75rem;
    overflow: auto;
    border-radius: 0.6rem;
    background: var(--tx-muted, Canvas);
    font-size: 0.8125rem;
  }
</style>
