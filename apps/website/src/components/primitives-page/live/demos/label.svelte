<script lang="ts" module>
import { attr, type DemoSpec, recipeLine, SCRIPT_END } from '../types.ts';

export const spec: DemoSpec = {
  props: [
    {
      kind: 'enum',
      name: 'orientation',
      label: 'Style layout',
      options: ['vertical', 'horizontal'],
      default: 'vertical',
    },
    { kind: 'boolean', name: 'invalid', label: 'invalid', default: false },
    { kind: 'boolean', name: 'required', label: 'required', default: false },
    { kind: 'boolean', name: 'disabled', label: 'disabled', default: false },
  ],
  keys: [],
  uncontrolled:
    'A plain value: FieldRoot wires the label, description and error to the control; click the label to focus it.',
  controlled:
    'bind:value on FieldControl plus invalid from your own check, run by the buttons outside.',
  code: (v) => `<script lang="ts">
  import { FieldControl, FieldDescription, FieldError, FieldLabel, FieldRoot, LabelRoot } from '@texuli/primitives/label';
  let email = $state('');
${SCRIPT_END}

<FieldRoot${attr('invalid', v.invalid === true, false)}${attr('required', v.required === true, false)}${attr('disabled', v.disabled === true, false)}>
  <FieldLabel>Work email</FieldLabel>
  <FieldControl type="email" bind:value={email} />
  <FieldDescription>We send receipts here.</FieldDescription>
  <FieldError>Enter an address like name@example.com.</FieldError>
</FieldRoot>

<LabelRoot for="company">Company</LabelRoot>
<input id="company" />

${recipeLine('fieldRootClass', 'texuli/field', { orientation: v.orientation ?? 'vertical' })}`,
  controlCheck: {
    act: '[data-demo-act="bad"]',
    expect: {
      selector: '[data-demo-part="FieldControl"]',
      attribute: 'aria-invalid',
      value: 'true',
    },
  },
};
</script>

<script lang="ts">
import {
  FieldControl,
  FieldDescription,
  FieldError,
  FieldLabel,
  FieldRoot,
  LabelRoot,
} from '@texuli/primitives/label';
import { Button } from 'texuli/button';
import { descriptionClass, fieldErrorClass, fieldRootClass, labelClass } from 'texuli/field';
import { fieldVariants, Input } from 'texuli/input';
import { bool, type DemoProps, str } from '../types.ts';

let { values, mode }: DemoProps = $props();

const orientation = $derived(str(values, 'orientation', 'vertical') === 'horizontal' ? 'horizontal' : 'vertical');
const required = $derived(bool(values, 'required'));
const disabled = $derived(bool(values, 'disabled'));
const rootClass = $derived(fieldRootClass({ orientation }));

let email = $state('');
let checked = $state(false);
const emailOk = $derived(/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email));
const invalid = $derived(mode === 'controlled' ? checked && !emailOk : bool(values, 'invalid'));

function fill(next: string): void {
  email = next;
  checked = true;
}
</script>

{#snippet field()}
  <FieldLabel class={labelClass()} data-tx-label="" data-demo-part="FieldLabel">
    Work email{#if required}<span class="tx-label__required" aria-hidden="true">*</span>{/if}
  </FieldLabel>
  <div class="tx-field-control">
    {#if mode === 'uncontrolled'}
      <FieldControl type="email" value="ada@example.com" class={fieldVariants()} data-demo-part="FieldControl" />
    {:else}
      <FieldControl type="email" bind:value={email} class={fieldVariants()} data-demo-part="FieldControl" />
    {/if}
  </div>
  <FieldDescription class={descriptionClass()} data-tx-description="" data-demo-part="FieldDescription">
    We send receipts here.
  </FieldDescription>
  <FieldError class={fieldErrorClass()} data-tx-field-error="" data-demo-part="FieldError">
    Enter an address like name@example.com.
  </FieldError>
{/snippet}

<FieldRoot {invalid} {required} {disabled} class={rootClass} data-tx-field="" data-demo-part="FieldRoot">
  {@render field()}
</FieldRoot>

{#if mode === 'uncontrolled'}
  <div class={fieldRootClass()} data-tx-field="">
    <LabelRoot for="live-label-company" class={labelClass()} data-tx-label="" data-demo-part="LabelRoot">Company</LabelRoot>
    <Input id="live-label-company" value="Harbor Example Co." {disabled} />
  </div>
{:else}
  <div class="demo-controls">
    <output data-demo-readout>value: "{email}" · invalid: {invalid}</output>
    <Button size="sm" variant="outline" onclick={() => fill('not-an-email')} data-demo-act="bad">Try "not-an-email"</Button>
    <Button size="sm" variant="ghost" onclick={() => fill('rio@example.com')}>Fill a valid address</Button>
  </div>
{/if}
