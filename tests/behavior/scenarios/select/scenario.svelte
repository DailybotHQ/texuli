<script lang="ts">
// Select scenario: @texuli/primitives Select public API (with groups).
import { Select } from '@texuli/primitives/select';
import { behaviorEvent } from '../../harness/client/events.ts';

const items = [
  { value: 'free', label: 'Free' },
  { value: 'team', label: 'Team' },
  { value: 'business', label: 'Business', disabled: true },
  { value: 'enterprise', label: 'Enterprise' },
];
let value = $state('free');
// `?ids=1`: consumer ids on the trigger and list, named by a <label for> (FIX-consumer-ids).
const consumerIds = new URLSearchParams(location.search).get('ids') === '1';
const selected = $derived(items.find((item) => item.value === value)?.label ?? 'Choose a plan');
</script>

<form
  onsubmit={(event) => {
    event.preventDefault();
    behaviorEvent('submit', Object.fromEntries(new FormData(event.currentTarget)));
  }}
>
  {#if consumerIds}
    <label for="plan-trigger">Plan</label>
  {:else}
    <span id="plan-label">Plan</span>
  {/if}
  <Select.Root
    type="single"
    bind:value
    name="plan"
    {items}
    onValueChange={(next) => behaviorEvent('valueChange', next)}
  >
    {#if consumerIds}
      <Select.Trigger id="plan-trigger">{selected}</Select.Trigger>
    {:else}
      <Select.Trigger aria-labelledby="plan-label">{selected}</Select.Trigger>
    {/if}
    <Select.Portal>
      <Select.Content
        id={consumerIds ? 'plan-list' : undefined}
        class="behavior-list"
        data-behavior-layer
        sideOffset={4}
      >
        <Select.Viewport>
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
        </Select.Viewport>
      </Select.Content>
    </Select.Portal>
  </Select.Root>
  <button type="submit">Save plan</button>
</form>

<style>
  :global(.behavior-list) {
    display: grid;
    min-inline-size: 10rem;
    padding: 0.25rem;
    border: 1px solid CanvasText;
    background: Canvas;
    color: CanvasText;
  }
</style>
