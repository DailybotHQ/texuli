<script lang="ts">
import { applyMove, createSortable, type SortableController } from '@texuli/drag/sortable';
import { untrack } from 'svelte';
import { validateFormSchema } from '../model/schema.ts';
import {
  FORM_FIELD_TYPES,
  FORM_FORMATS,
  type FormField,
  type FormFieldType,
  type FormSchema,
} from '../model/types.ts';
import SchemaForm from '../view/SchemaForm.svelte';
import {
  builderFields,
  createBuilderField,
  reorderBuilderFields,
  withBuilderFields,
} from './model.ts';

interface Props {
  schema?: FormSchema;
  onChange?: (schema: FormSchema) => void;
}
let { schema: initialSchema = { title: 'Untitled form', fields: [] }, onChange }: Props = $props();
let fields = $state<readonly FormField[]>(untrack(() => builderFields(initialSchema)));
let title = $state(untrack(() => initialSchema.title));
let selected = $state(untrack(() => fields[0]?.name ?? ''));
let jsonOpen = $state(false);
let announcement = $state('');
let rowNodes: Record<string, HTMLLIElement> = {};
let canvas: HTMLOListElement;
let controller: SortableController = createSortable({
  containers: [{ id: 'fields', items: untrack(() => fields.map((field) => field.name)) }],
  requireHandle: true,
  labelOf: (id: string) => fields.find((field) => field.name === id)?.label ?? id,
  announce: (message: string) => {
    announcement = message;
  },
});
let formSchema = $derived(withBuilderFields({ title, fields }, fields));
let validation = $derived(validateFormSchema(formSchema, { tier: 'developer' }));
let schemaJson = $derived(JSON.stringify(formSchema, null, 2));
let current = $derived(fields.find((field) => field.name === selected));

function sync(next: readonly FormField[]) {
  fields = next;
  if (!next.some((field) => field.name === selected)) selected = next[0]?.name ?? '';
  const schema = withBuilderFields({ title, fields: next }, next);
  controller.setContainers([{ id: 'fields', items: next.map((field) => field.name) }]);
  onChange?.(schema);
}
function addField(type: FormFieldType) {
  const field = createBuilderField(type, fields);
  if (!field) return;
  sync([...fields, field]);
  selected = field.name;
  announcement = `${field.label} added.`;
}
function update(name: string, patch: Partial<FormField>) {
  sync(fields.map((field) => (field.name === name ? { ...field, ...patch } : field)));
}
function move(name: string, index: number) {
  const next = reorderBuilderFields(fields, name, index);
  if (next !== fields) sync(next);
}
function pickUp(name: string, event: PointerEvent) {
  if (event.button !== 0) return;
  event.currentTarget instanceof HTMLElement &&
    event.currentTarget.setPointerCapture(event.pointerId);
  controller.pickUp(name, { fromHandle: true, point: { x: event.clientX, y: event.clientY } });
}
function pointerMove(event: PointerEvent) {
  controller.pointerMove({ x: event.clientX, y: event.clientY });
  if (controller.state.phase !== 'dragging' || !controller.state.source || !canvas) return;
  const rows = [...canvas.querySelectorAll<HTMLElement>('[data-field-row]')];
  const target = rows.find((row) => {
    const rect = row.getBoundingClientRect();
    return event.clientY < rect.top + rect.height / 2;
  });
  const targetIndex = target ? rows.indexOf(target) : rows.length - 1;
  controller.over({ containerId: 'fields', index: Math.max(0, targetIndex) });
}
function commitMove(moveResult = controller.drop()) {
  if (!moveResult?.changed) return;
  const ordered = applyMove(
    [{ id: 'fields', items: fields.map((field) => field.name) }],
    moveResult
  )[0]?.items;
  if (ordered)
    sync(
      ordered.flatMap((name: string) => {
        const field = fields.find((item) => item.name === name);
        return field ? [field] : [];
      })
    );
}
function keyboardReorder(name: string, event: KeyboardEvent) {
  const direction =
    event.altKey && event.key === 'ArrowUp'
      ? -1
      : event.altKey && event.key === 'ArrowDown'
        ? 1
        : 0;
  if (!direction) return;
  event.preventDefault();
  controller.pickUp(name, { input: 'keyboard', fromHandle: true });
  controller.intent(direction < 0 ? 'movePrev' : 'moveNext');
  commitMove();
  const nextIndex = fields.findIndex((field) => field.name === name);
  rowNodes[name]?.querySelector<HTMLButtonElement>('.handle')?.focus();
  announcement = `${fields[nextIndex]?.label ?? 'Field'} is at position ${nextIndex + 1} of ${fields.length}.`;
}
function optionLines(field: FormField): string {
  return (field.options ?? []).map((option) => `${option.value}|${option.label}`).join('\n');
}
function setOptions(field: FormField, value: string) {
  const options = value
    .split('\n')
    .slice(0, 200)
    .flatMap((line) => {
      const [optionValue, ...labelParts] = line.split('|');
      const label = labelParts.join('|').trim();
      return optionValue?.trim() && label ? [{ value: optionValue.trim(), label }] : [];
    });
  update(field.name, { options });
}
</script>

<section class="builder" aria-label="Form builder">
  <header class="builder-header">
    <label>Form title <input value={title} maxlength="200" oninput={(event) => { title = event.currentTarget.value; onChange?.(formSchema); }} /></label>
    <p class:invalid={!validation.ok} aria-live="polite">{validation.ok ? `${fields.length} fields · schema valid` : `${validation.issues.length} schema issue${validation.issues.length === 1 ? '' : 's'}`}</p>
  </header>
  <div class="builder-grid">
    <nav aria-label="Field palette">
      <h2>Fields</h2>
      <div class="palette" role="group" aria-label="Add a field">
        {#each FORM_FIELD_TYPES.filter((type) => type !== 'password' && type !== 'otp' && type !== 'file' && type !== 'custom') as type}
          <button type="button" onclick={() => addField(type)}>{type}</button>
        {/each}
      </div>
    </nav>
    <section aria-label="Form canvas">
      <h2>Canvas</h2>
      {#if fields.length === 0}<p class="empty">Choose a field to start building your form.</p>{/if}
      <ol bind:this={canvas} aria-label="Form fields" onpointermove={pointerMove} onpointerup={() => commitMove()} onpointercancel={() => controller.cancel()}>
        {#each fields as field, index (field.name)}
          <li bind:this={rowNodes[field.name]} data-field-row aria-current={selected === field.name ? 'true' : undefined}>
            <button class="handle" type="button" aria-label={`Reorder ${field.label}. Use Alt plus Arrow Up or Arrow Down to move.`} onpointerdown={(event) => pickUp(field.name, event)} onkeydown={(event) => keyboardReorder(field.name, event)}>⠿</button>
            <button class="field-select" type="button" onclick={() => { selected = field.name; }}>{field.label}<small>{field.type}</small></button>
            <button type="button" aria-label={`Move ${field.label} up`} disabled={index === 0} onclick={() => move(field.name, index - 1)}>↑</button>
            <button type="button" aria-label={`Move ${field.label} down`} disabled={index === fields.length - 1} onclick={() => move(field.name, index + 1)}>↓</button>
            <button type="button" aria-label={`Remove ${field.label}`} onclick={() => sync(fields.filter((item) => item.name !== field.name))}>×</button>
          </li>
        {/each}
      </ol>
      <p class="sr-only" role="status" aria-live="polite">{announcement}</p>
    </section>
    <aside aria-label="Field inspector">
      <h2>Inspector</h2>
      {#if current}
        <label>Label <input value={current.label} maxlength="200" oninput={(event) => update(current!.name, { label: event.currentTarget.value })} /></label>
        <label>Field name <input value={current.name} readonly /></label>
        <label class="check"><input type="checkbox" checked={current.required ?? false} onchange={(event) => update(current!.name, { required: event.currentTarget.checked })} /> Required</label>
        {#if current.type === 'text' || current.type === 'textarea' || current.type === 'tags'}
          <label>Format <select value={current.format ?? ''} onchange={(event) => update(current!.name, { format: (event.currentTarget.value || undefined) as FormField['format'] })}><option value="">None</option>{#each FORM_FORMATS as format}<option value={format}>{format}</option>{/each}</select></label>
        {/if}
        {#if current.type === 'select' || current.type === 'multiselect' || current.type === 'radio'}
          <label>Options <small>One value|label pair per line</small><textarea rows="4" value={optionLines(current)} oninput={(event) => setOptions(current!, event.currentTarget.value)}></textarea></label>
        {/if}
        <label>Show condition <small>Expression JSON</small><textarea rows="3" value={JSON.stringify(current.when?.show ?? '')} oninput={(event) => {
          const raw = event.currentTarget.value.trim();
          if (!raw || raw === '""') {
            update(current!.name, { when: undefined });
            return;
          }
          try { const show = JSON.parse(raw) as NonNullable<FormField['when']>['show']; update(current!.name, { when: { ...current!.when, show } }); } catch { /* Keep the current valid schema while the expression is incomplete. */ }
        }}></textarea></label>
      {:else}<p>Select a field on the canvas to edit it.</p>{/if}
    </aside>
    <section class="preview" aria-label="Live form preview">
      <h2>Preview</h2>
      {#if validation.ok}<SchemaForm form={validation.form} />{:else}<p>Complete the schema to preview the form.</p>{/if}
    </section>
    <section class="schema-view" aria-label="Schema JSON">
      <h2>Schema</h2>
      <button type="button" aria-expanded={jsonOpen} onclick={() => jsonOpen = !jsonOpen}>{jsonOpen ? 'Hide JSON' : 'View JSON'}</button>
      {#if jsonOpen}<pre>{schemaJson}</pre>{/if}
    </section>
  </div>
</section>

<style>
  .builder { color: var(--tx-foreground, CanvasText); background: var(--tx-background, Canvas); display: grid; gap: 1rem; }
  .builder-header, .builder-grid { display: grid; gap: 1rem; }
  .builder-header { grid-template-columns: 1fr auto; align-items: end; padding: 1rem; border: 1px solid var(--tx-border, GrayText); border-radius: var(--tx-radius-md, .5rem); }
  .builder-grid { grid-template-columns: minmax(9rem, .8fr) minmax(15rem, 1.4fr) minmax(13rem, 1fr); }
  nav, .builder-grid > section, aside { padding: 1rem; border: 1px solid var(--tx-border, GrayText); border-radius: var(--tx-radius-md, .5rem); min-inline-size: 0; }
  h2 { margin: 0 0 .75rem; font-size: 1rem; }
  label { display: grid; gap: .35rem; margin-block: .6rem; font-weight: 600; }
  input, select, textarea, button { color: inherit; font: inherit; }
  input, select, textarea { inline-size: 100%; box-sizing: border-box; padding: .45rem; border: 1px solid var(--tx-border, GrayText); border-radius: var(--tx-radius-sm, .25rem); background: var(--tx-background, Canvas); }
  button { cursor: pointer; border: 1px solid var(--tx-border, GrayText); border-radius: var(--tx-radius-sm, .25rem); background: var(--tx-surface, Canvas); padding: .4rem .55rem; }
  button:focus-visible, li:focus-visible, input:focus-visible, select:focus-visible, textarea:focus-visible { outline: 3px solid var(--tx-focus, Highlight); outline-offset: 2px; }
  .palette { display: flex; flex-wrap: wrap; gap: .35rem; }
  ol { list-style: none; display: grid; gap: .45rem; margin: 0; padding: 0; }
  li { display: flex; gap: .35rem; align-items: center; padding: .4rem; border: 1px solid var(--tx-border, GrayText); border-radius: var(--tx-radius-sm, .25rem); }
  li[aria-current="true"] { border-color: var(--tx-primary, Highlight); }
  .field-select { flex: 1; text-align: start; display: grid; }
  small { display: block; opacity: .75; font-size: .75rem; }
  .check { display: flex; align-items: center; }
  .check input { inline-size: auto; }
  .preview, .schema-view { grid-column: 2 / 4; }
  .schema-view pre { max-block-size: 24rem; overflow: auto; padding: .75rem; background: var(--tx-surface, Canvas); }
  .invalid { color: var(--tx-danger, #a11); }
  .empty { padding: 1rem; border: 1px dashed var(--tx-border, GrayText); }
  .sr-only { position: absolute; inline-size: 1px; block-size: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
  @media (max-width: 48rem) { .builder-grid { grid-template-columns: 1fr; } .preview, .schema-view { grid-column: 1; } .builder-header { grid-template-columns: 1fr; } }
</style>
