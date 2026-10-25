<!-- Lazily loaded: carry the styles with the component (Astro attaches lazily
     imported component CSS only to some pages). -->
<svelte:options css="injected" />

<script lang="ts">
/**
 * Combobox and MultiSelect, the real styled components inside a form. The
 * folded filter matches without accents ("sao" finds "São Paulo"), and
 * submitting shows what the form posts (one entry per value for
 * MultiSelect). The panel drives disabled, required, the required message,
 * the field name, size and variant.
 */
import { Button } from 'texuli/button';
import { Combobox, type ComboboxItemData, createFoldedFilter, MultiSelect } from 'texuli/combobox';
import { readers, type StageValues } from './values.ts';

type Props = { componentId: string; values: StageValues };

let { componentId, values }: Props = $props();

const { str, bool, pick } = readers(() => values);

const CITIES: ComboboxItemData[] = [
  { value: 'bogota', label: 'Bogotá' },
  { value: 'lisbon', label: 'Lisbon' },
  { value: 'montreal', label: 'Montréal' },
  { value: 'sao-paulo', label: 'São Paulo' },
  { value: 'zurich', label: 'Zürich' },
];
const SIZES = ['sm', 'md', 'lg'] as const;
const VARIANTS = ['outline', 'soft'] as const;
const filter = createFoldedFilter();

const multiple = $derived(componentId === 'multi-select');
const name = $derived(str('name', multiple ? 'cities' : 'city'));
const size = $derived(pick('size', SIZES, 'md'));
const variant = $derived(pick('variant', VARIANTS, 'outline'));
const disabled = $derived(bool('disabled'));
const required = $derived(bool('required'));
const requiredMessage = $derived(str('requiredMessage', 'Choose a city.'));

let city = $state('');
let cities = $state<string[]>([]);
let open = $state(false);
let submitted = $state('');

function onsubmit(event: SubmitEvent & { currentTarget: HTMLFormElement }): void {
  event.preventDefault();
  const posted = new FormData(event.currentTarget).getAll(name).map(String);
  submitted = posted.length ? `${name}: ${posted.join(', ')}` : `${name}: nothing`;
}
</script>

<form class="stage" data-tx-live-component={componentId} {onsubmit}>
  <label class="label" for={`${componentId}-input`}>{multiple ? 'Cities' : 'City'}</label>
  {#if multiple}
    <MultiSelect.Root
      bind:value={cities}
      bind:open
      items={CITIES}
      {filter}
      {name}
      {required}
      {requiredMessage}
      {disabled}
      {size}
      {variant}
    >
      <MultiSelect.Field {open} {disabled} {variant} {size}>
        <MultiSelect.Chips aria-label="Selected cities">
          {#each cities as value (value)}
            <MultiSelect.Chip {value} />
          {/each}
        </MultiSelect.Chips>
        <MultiSelect.Input id={`${componentId}-input`} placeholder="Add a city" />
        <MultiSelect.Trigger aria-label="Show cities" />
      </MultiSelect.Field>
      <MultiSelect.Portal>
        <MultiSelect.Content aria-label="Cities">
          <MultiSelect.Empty />
          <MultiSelect.Viewport>
            {#snippet children(item)}
              <MultiSelect.Item value={item.value} label={item.label}>{item.label}</MultiSelect.Item>
            {/snippet}
          </MultiSelect.Viewport>
        </MultiSelect.Content>
      </MultiSelect.Portal>
    </MultiSelect.Root>
  {:else}
    <Combobox.Root
      bind:value={city}
      bind:open
      items={CITIES}
      {filter}
      {name}
      {required}
      {requiredMessage}
      {disabled}
      {size}
      {variant}
    >
      <Combobox.Field {open} {disabled} {variant} {size}>
        <Combobox.Input id={`${componentId}-input`} placeholder="Search cities (try sao)" />
        <Combobox.Trigger aria-label="Show cities" />
      </Combobox.Field>
      <Combobox.Portal>
        <Combobox.Content aria-label="Cities">
          <Combobox.Empty />
          <Combobox.Viewport>
            {#snippet children(item)}
              <Combobox.Item value={item.value} label={item.label}>{item.label}</Combobox.Item>
            {/snippet}
          </Combobox.Viewport>
        </Combobox.Content>
      </Combobox.Portal>
    </Combobox.Root>
  {/if}
  <Button type="submit" size="sm" variant="outline">Submit</Button>
  <p class="state" role="status">{submitted || 'Not submitted yet'}</p>
</form>

<style>
  .stage {
    display: grid;
    gap: 0.4rem;
    justify-items: start;
    min-inline-size: min(100%, 18rem);
  }
  .label {
    font-size: 0.875rem;
    font-weight: 600;
  }
  .state {
    margin: 0;
    font-size: 0.875rem;
  }
</style>
