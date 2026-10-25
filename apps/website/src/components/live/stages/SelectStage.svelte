<!-- Lazily loaded: carry the styles with the component (Astro attaches lazily
     imported component CSS only to some pages). -->
<svelte:options css="injected" />

<script lang="ts">
/**
 * The Select composite. Every select-* part mounts inside a working select,
 * and the panel drives the part the card is about.
 */
import { Select } from 'texuli/select';
import { readers, type StageValues } from './values.ts';

type Props = { componentId: string; values: StageValues };

let { componentId, values }: Props = $props();

const { str, bool, pick } = readers(() => values);

const PLANS = [
  { value: 'free', label: 'Free', description: 'One seat' },
  { value: 'pro', label: 'Pro', description: 'For growing teams' },
  { value: 'team', label: 'Team', description: 'Up to 25 seats' },
];
const SIZES = ['sm', 'md', 'lg'] as const;
const VARIANTS = ['outline', 'soft'] as const;

let value = $state('');
let open = $state(false);

const own = (id: string) => componentId === id;
const rootSize = $derived(own('select') ? pick('size', SIZES, 'md') : 'md');
const rootVariant = $derived(own('select') ? pick('variant', VARIANTS, 'outline') : 'outline');
const triggerSize = $derived(own('select-trigger') ? pick('size', SIZES, rootSize) : rootSize);
const triggerVariant = $derived(
  own('select-trigger') ? pick('variant', VARIANTS, rootVariant) : rootVariant
);
const contentSize = $derived(own('select-content') ? pick('size', SIZES, rootSize) : rootSize);
const item = $derived({
  value: 'pro',
  label: own('select-item') ? str('label', 'Pro') : 'Pro',
  description: own('select-item') ? str('description', 'For growing teams') : 'For growing teams',
  disabled: own('select-item') && bool('disabled'),
});
</script>

<div class="stage" data-tx-select-stage={componentId}>
  <span class="label" id={`${componentId}-label`}>Plan</span>
  <Select.Root
    bind:value
    bind:open
    items={PLANS}
    name="plan"
    size={rootSize}
    variant={rootVariant}
    disabled={own('select') && bool('disabled')}
    required={own('select') && bool('required')}
  >
    <Select.Trigger aria-labelledby={`${componentId}-label`} size={triggerSize} variant={triggerVariant}>
      <Select.Value placeholder={own('select-value') ? str('placeholder', 'Choose a plan') : 'Choose a plan'} />
    </Select.Trigger>
    <Select.Portal>
      <Select.Content size={contentSize}>
        <Select.Viewport>
          <Select.Group>
            <Select.Label>Billing plans</Select.Label>
            <Select.Item value="free" label="Free" description="One seat">Free</Select.Item>
            <Select.Item value={item.value} label={item.label} description={item.description} disabled={item.disabled}>
              {item.label}
            </Select.Item>
          </Select.Group>
          <Select.Separator />
          <Select.Item value="team" label="Team" description="Up to 25 seats">Team</Select.Item>
        </Select.Viewport>
      </Select.Content>
    </Select.Portal>
  </Select.Root>
  <p class="state" role="status">{value ? `Selected: ${value}` : 'Nothing selected yet'}</p>
</div>

<style>
  .stage {
    display: grid;
    gap: 0.4rem;
    justify-items: start;
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
