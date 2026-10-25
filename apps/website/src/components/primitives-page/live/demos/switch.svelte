<script lang="ts" module>
import { attr, type DemoSpec, recipeLine, SCRIPT_END } from '../types.ts';

export const spec: DemoSpec = {
  props: [
    { kind: 'enum', name: 'size', label: 'Size', options: ['sm', 'md'], default: 'md' },
    { kind: 'boolean', name: 'disabled', label: 'disabled', default: false },
    { kind: 'string', name: 'label', label: 'Label text', default: 'Email alerts' },
  ],
  keys: [{ keys: [' ', 'Enter'], action: 'Turn the switch on or off' }],
  uncontrolled: 'defaultChecked starts it on; the switch keeps its own state.',
  controlled:
    'bind:checked keeps the state in your code, so buttons outside can turn it on or off.',
  code: (v) => `<script lang="ts">
  import { Switch } from '@texuli/primitives/switch';
  let checked = $state(true);
${SCRIPT_END}

<label for="alerts">${String(v.label)}</label>
<Switch.Root id="alerts" bind:checked${attr('disabled', v.disabled === true, false)}>
  <Switch.Thumb />
</Switch.Root>
${recipeLine('switchControlClass', 'texuli/choice', { size: String(v.size) })}`,
  keyCheck: {
    focus: '[data-demo-part="Switch.Root"]',
    press: ' ',
    expect: {
      selector: '[data-demo-part="Switch.Root"]',
      attribute: 'aria-checked',
      value: 'false',
    },
  },
  controlCheck: {
    act: '[data-demo-act="off"]',
    expect: {
      selector: '[data-demo-part="Switch.Root"]',
      attribute: 'aria-checked',
      value: 'false',
    },
  },
};
</script>

<script lang="ts">
import { Switch } from '@texuli/primitives/switch';
import { Button } from 'texuli/button';
import { switchControlClass } from 'texuli/choice';
import { bool, type DemoProps, str } from '../types.ts';

let { values, mode }: DemoProps = $props();

const size = $derived(str(values, 'size', 'md') === 'sm' ? 'sm' : 'md');
const disabled = $derived(bool(values, 'disabled'));
const label = $derived(str(values, 'label', 'Email alerts').trim() || 'Email alerts');
const controlClass = $derived(switchControlClass({ size }));
const uid = $props.id();
const id = `${uid}-switch`;

let checked = $state(true);
</script>

<div class="tx-choice tx-choice--switch" data-tx-choice-field="switch">
  <div class="tx-choice__copy">
    <label class="tx-choice__label" for={id}>{label}</label>
  </div>
  <span class="tx-choice__hit">
    {#if mode === 'uncontrolled'}
      <Switch.Root {id} defaultChecked {disabled} class={controlClass} data-tx-choice="switch" data-demo-part="Switch.Root">
        <Switch.Thumb class="tx-switch-thumb" data-demo-part="Switch.Thumb" />
      </Switch.Root>
    {:else}
      <Switch.Root {id} bind:checked {disabled} class={controlClass} data-tx-choice="switch" data-demo-part="Switch.Root">
        <Switch.Thumb class="tx-switch-thumb" data-demo-part="Switch.Thumb" />
      </Switch.Root>
    {/if}
  </span>
</div>

{#if mode === 'controlled'}
  <div class="demo-controls">
    <output data-demo-readout>checked: {checked}</output>
    <Button size="sm" variant="outline" onclick={() => (checked = true)} data-demo-act="on">Turn on</Button>
    <Button size="sm" variant="outline" onclick={() => (checked = false)} data-demo-act="off">Turn off</Button>
  </div>
{/if}
