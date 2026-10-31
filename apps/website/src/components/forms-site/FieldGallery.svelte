<script lang="ts">
/**
 * /forms-page/ field gallery: one `SchemaForm` with a field of every
 * `FORM_FIELD_TYPES` entry (FIELDS_SCHEMA), and beside it the typed values
 * the form holds, live, and what a submit sends (visible, enabled fields
 * only; file fields send their File objects to the host, never upload).
 */
import { SchemaForm, type SchemaFormCustomField } from '@texuli/forms';
import { type FormValues, validateFormSchema } from '@texuli/forms/model';
import { FIELDS_SCHEMA, FIELDS_VALUES, GALLERY_OPTIONS } from './schemas.ts';

const result = validateFormSchema(FIELDS_SCHEMA, GALLERY_OPTIONS);
/** The fictional people the custom `person` field picks from. */
const PEOPLE = [
  { id: 'p-ada', name: 'Ada Example' },
  { id: 'p-grace', name: 'Grace Example' },
  { id: 'p-alan', name: 'Alan Example' },
];
let values = $state.raw<FormValues>({});
let sent = $state('');

function show(value: unknown): string {
  return JSON.stringify(value, null, 2);
}
</script>

{#snippet person(ctx: SchemaFormCustomField)}
  <select
    {...ctx.props}
    class="gallery__picker"
    data-forms-person=""
    value={typeof ctx.value === 'string' ? ctx.value : ''}
    onchange={(event) => ctx.setValue((event.currentTarget as HTMLSelectElement).value || null)}
    onblur={() => ctx.blur()}
  >
    <option value="">Nobody yet</option>
    {#each PEOPLE as entry (entry.id)}<option value={entry.id}>{entry.name}</option>{/each}
  </select>
{/snippet}

<div class="gallery" data-forms-gallery="">
  <div class="gallery__form">
    {#if result.ok}
      <SchemaForm
        form={result.form}
        values={FIELDS_VALUES}
        headingLevel={3}
        field={person}
        onValueChange={(_name, _value, all) => {
          values = all;
        }}
        onSubmit={({ values: submitted, files }) => {
          const names = Object.fromEntries(
            Object.entries(files).map(([name, list]) => [name, list.map((file) => file.name)])
          );
          sent = show({ values: submitted, files: names });
          return { ok: true };
        }}
      />
    {:else}
      <p role="alert">The gallery schema did not validate.</p>
    {/if}
  </div>
  <div class="gallery__side">
    <h3 class="gallery__title">Typed values</h3>
    <p class="gallery__hint">
      Numbers are numbers, dates are <code>YYYY-MM-DD</code>, choices are lists. Change any field.
    </p>
    <pre class="gallery__json" data-forms-values="" aria-label="Current values" tabindex="0">{show(
        Object.keys(values).length > 0 ? values : FIELDS_VALUES
      )}</pre>
    {#if sent}
      <h3 class="gallery__title">Submitted</h3>
      <pre class="gallery__json" data-forms-sent="" aria-label="Submitted values" tabindex="0">{sent}</pre>
    {/if}
  </div>
</div>

<style>
  .gallery {
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
  .gallery__form,
  .gallery__side {
    display: grid;
    gap: 0.6rem;
    min-inline-size: 0;
  }
  .gallery__side {
    position: sticky;
    inset-block-start: 5rem;
  }
  .gallery__title {
    margin: 0;
    font-size: 1rem;
  }
  .gallery__hint {
    margin: 0;
    font-size: 0.875rem;
    color: var(--tx-muted-foreground, CanvasText);
  }
  .gallery__json {
    margin: 0;
    max-block-size: 24rem;
    padding: 0.75rem;
    overflow: auto;
    border-radius: 0.6rem;
    background: var(--tx-muted, Canvas);
    font-size: 0.8125rem;
  }
  .gallery__picker {
    min-block-size: 2.5rem;
    padding-inline: 0.6rem;
    border: 1px solid var(--tx-border, CanvasText);
    border-radius: 0.5rem;
    background: var(--tx-surface, Canvas);
    color: inherit;
    font: inherit;
  }
  .gallery__picker:focus-visible,
  .gallery__json:focus-visible {
    outline: 2px solid var(--tx-ring, Highlight);
    outline-offset: 2px;
  }
</style>
