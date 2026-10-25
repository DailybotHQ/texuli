<script lang="ts">
import { Select } from '../../src/select/index.ts';

const flatItems = [
  { value: 'free', label: 'Free' },
  { value: 'team', label: 'Team' },
  { value: 'business', label: 'Business', disabled: true },
  { value: 'enterprise', label: 'Enterprise' },
];

let {
  value = $bindable('free'),
  name = 'plan',
  withForm = false,
  grouped = false,
  onValueChange,
  onSubmit,
}: {
  value?: string;
  name?: string;
  withForm?: boolean;
  grouped?: boolean;
  onValueChange?: (value: string) => void;
  onSubmit?: (data: Record<string, FormDataEntryValue>) => void;
} = $props();

const selected = $derived(flatItems.find((item) => item.value === value)?.label ?? 'Choose a plan');
</script>

{#snippet options()}
  {#if grouped}
    <Select.Group>
      <Select.GroupLabel>Personal</Select.GroupLabel>
      <Select.Item value="free" label="Free">Free</Select.Item>
    </Select.Group>
    <Select.Group>
      <Select.GroupLabel>Organization</Select.GroupLabel>
      <Select.Item value="team" label="Team">Team</Select.Item>
      <Select.Item value="business" label="Business" disabled>Business</Select.Item>
      <Select.Item value="enterprise" label="Enterprise">Enterprise</Select.Item>
    </Select.Group>
  {:else}
    {#each flatItems as item (item.value)}
      <Select.Item value={item.value} label={item.label} disabled={item.disabled}
        >{item.label}</Select.Item
      >
    {/each}
  {/if}
{/snippet}

{#snippet field()}
  <span id="plan-label">Plan</span>
  <Select.Root
    type="single"
    bind:value
    {name}
    items={grouped ? undefined : flatItems}
    {onValueChange}
  >
    <Select.Trigger aria-labelledby="plan-label">{selected}</Select.Trigger>
    <Select.Portal>
      <Select.Content class="parity-list" sideOffset={4}>
        <Select.Viewport>
          {@render options()}
        </Select.Viewport>
      </Select.Content>
    </Select.Portal>
  </Select.Root>
{/snippet}

{#if withForm}
  <form
    onsubmit={(event) => {
      event.preventDefault();
      onSubmit?.(Object.fromEntries(new FormData(event.currentTarget)));
    }}
  >
    {@render field()}
    <button type="submit">Save plan</button>
  </form>
{:else}
  {@render field()}
{/if}

<style>
  :global(.parity-list) {
    display: grid;
    min-inline-size: 10rem;
    padding: 0.25rem;
    border: 1px solid CanvasText;
    background: Canvas;
    color: CanvasText;
  }
</style>
