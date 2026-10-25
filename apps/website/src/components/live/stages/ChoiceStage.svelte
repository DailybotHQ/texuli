<!-- Lazily loaded: carry the styles with the component (Astro attaches lazily
     imported component CSS only to some pages). -->
<svelte:options css="injected" />

<script lang="ts">
/**
 * Checkbox, Radio, RadioGroup and Switch: operable with pointer and keyboard,
 * the panel-driven control first, then the other states.
 */
import { Checkbox, Radio, RadioGroup, Switch } from 'texuli/choice';
import { readers, type StageValues } from './values.ts';

type Props = { componentId: string; values: StageValues };

let { componentId, values }: Props = $props();

const { str, bool, pick } = readers(() => values);

const OPTIONS = [
  { value: 'mail', label: 'Email', description: 'A daily digest' },
  { value: 'sms', label: 'SMS', description: 'Urgent alerts only' },
  { value: 'push', label: 'Push', description: 'On this device', disabled: true },
];

let checked = $state(false);
let plan = $state('mail');

$effect(() => {
  checked = bool('checked', componentId === 'switch');
});
</script>

<div class="stage" data-tx-choice-stage={componentId}>
  {#if componentId === 'checkbox'}
    <Checkbox
      bind:checked
      label={str('label', 'Subscribe to updates')}
      description={str('description') || undefined}
      indeterminate={bool('indeterminate')}
      disabled={bool('disabled')}
      required={bool('required')}
      size={pick('size', ['sm', 'md'] as const, 'md')}
    />
    <p class="state" role="status">{checked ? 'Subscribed' : 'Not subscribed'}</p>
    <div class="stack" aria-label="Checkbox states">
      <Checkbox label="Indeterminate" indeterminate />
      <Checkbox label="Small" size="sm" checked />
      <Checkbox label="Disabled" disabled checked />
    </div>
  {:else if componentId === 'switch'}
    <Switch
      bind:checked
      label={str('label', 'Dark mode')}
      description={str('description') || undefined}
      disabled={bool('disabled')}
      required={bool('required')}
      size={pick('size', ['sm', 'md'] as const, 'md')}
    />
    <p class="state" role="status">{checked ? 'On' : 'Off'}</p>
    <div class="stack" aria-label="Switch states">
      <Switch label="Small" size="sm" />
      <Switch label="Disabled" disabled checked />
    </div>
  {:else if componentId === 'radio'}
    <RadioGroup bind:value={plan} name="radio-demo" aria-label="Delivery">
      <Radio
        value="mail"
        label={str('label', 'Email')}
        description={str('description') || undefined}
        disabled={bool('disabled')}
        size={pick('size', ['sm', 'md'] as const, 'md')}
      />
      <Radio value="sms" label="SMS" />
      <Radio value="push" label="Push" disabled />
    </RadioGroup>
    <p class="state" role="status">Chosen: {plan}</p>
  {:else}
    <RadioGroup
      bind:value={plan}
      name="radio-group-demo"
      items={OPTIONS}
      orientation={pick('orientation', ['vertical', 'horizontal'] as const, 'vertical')}
      variant={pick('variant', ['default', 'card'] as const, 'default')}
      size={pick('size', ['sm', 'md'] as const, 'md')}
      disabled={bool('disabled')}
      required={bool('required')}
      aria-label="Notification channel"
    />
    <p class="state" role="status">Chosen: {plan}</p>
  {/if}
</div>

<style>
  .stage,
  .stack {
    display: grid;
    /* Small controls (14–16 px) keep 24 px of safe space between rows (target-size). */
    gap: 1rem;
  }
  .state {
    margin: 0;
    font-size: 0.875rem;
  }
</style>
