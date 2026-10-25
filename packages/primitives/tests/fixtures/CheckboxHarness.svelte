<script lang="ts">
import { Checkbox } from '../../src/checkbox/index.ts';

type Props = {
  label?: string;
  name?: string;
  value?: string;
  disabled?: boolean;
  indeterminate?: boolean;
  checked?: boolean;
  withForm?: boolean;
  mode?: 'single' | 'group';
  onCheckedChange?: (checked: boolean) => void;
  onSubmit?: (data: Record<string, FormDataEntryValue>) => void;
};

let {
  label = 'Option',
  name,
  value = 'on',
  disabled = false,
  indeterminate = $bindable(false),
  checked = $bindable(false),
  withForm = false,
  mode = 'single',
  onCheckedChange,
  onSubmit,
}: Props = $props();

const id = $props.id();
</script>

{#if mode === 'group'}
  <Checkbox.Group name="letters">
    <div>
      <Checkbox.Root id="{id}-a" value="a">
        {#snippet children({ checked: on })}
          <span aria-hidden="true">{on ? '✓' : ''}</span>
        {/snippet}
      </Checkbox.Root>
      <label for="{id}-a">Alpha</label>
    </div>
    <div>
      <Checkbox.Root id="{id}-b" value="b">
        {#snippet children({ checked: on })}
          <span aria-hidden="true">{on ? '✓' : ''}</span>
        {/snippet}
      </Checkbox.Root>
      <label for="{id}-b">Beta</label>
    </div>
  </Checkbox.Group>
{:else if withForm}
  <form
    onsubmit={(event) => {
      event.preventDefault();
      onSubmit?.(Object.fromEntries(new FormData(event.currentTarget)));
    }}
  >
    <Checkbox.Root
      id={id}
      {name}
      {value}
      bind:checked
      bind:indeterminate
      {disabled}
      {onCheckedChange}
    >
      {#snippet children({ checked: on, indeterminate: mixed })}
        <span aria-hidden="true">{mixed ? '–' : on ? '✓' : ''}</span>
      {/snippet}
    </Checkbox.Root>
    <label for={id}>{label}</label>
    <button type="submit">Save</button>
  </form>
{:else}
  <Checkbox.Root id={id} {name} {value} bind:checked bind:indeterminate {disabled} {onCheckedChange}>
    {#snippet children({ checked: on, indeterminate: mixed })}
      <span aria-hidden="true">{mixed ? '–' : on ? '✓' : ''}</span>
    {/snippet}
  </Checkbox.Root>
  <label for={id}>{label}</label>
{/if}
