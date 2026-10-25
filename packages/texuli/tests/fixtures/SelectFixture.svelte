<script lang="ts">
import { Select, type SelectSize, type SelectVariant } from '../../src/components/select/index.ts';

const items = [
  { value: 'free', label: 'Free', description: 'Solo builders' },
  { value: 'team', label: 'Team', description: 'Up to 10 seats' },
  { value: 'business', label: 'Business', disabled: true, description: 'Coming soon' },
  { value: 'enterprise', label: 'Enterprise', description: 'Custom limits' },
];

let {
  open = $bindable(false),
  value = $bindable('free'),
  size = 'md' as SelectSize,
  variant = 'outline' as SelectVariant,
  disabled = false,
  placeholder = 'Choose a plan',
}: {
  open?: boolean;
  value?: string;
  size?: SelectSize;
  variant?: SelectVariant;
  disabled?: boolean;
  placeholder?: string;
} = $props();
</script>

<span id="plan-label">Plan</span>
<Select.Root bind:open bind:value {size} {variant} {disabled} name="plan" {items}>
  <Select.Trigger aria-labelledby="plan-label" {size} {variant}>
    <Select.Value {placeholder} />
  </Select.Trigger>
  <Select.Portal>
    <Select.Content {size}>
      <Select.Viewport>
        <Select.Group>
          <Select.Label>Plans</Select.Label>
          {#each items as item (item.value)}
            <Select.Item
              value={item.value}
              label={item.label}
              disabled={item.disabled}
              description={item.description}
            >
              {item.label}
            </Select.Item>
          {/each}
        </Select.Group>
        <Select.Separator />
      </Select.Viewport>
    </Select.Content>
  </Select.Portal>
</Select.Root>
