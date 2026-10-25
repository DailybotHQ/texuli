<script lang="ts" module>
import { attr, type DemoSpec, recipeLine, SCRIPT_END } from '../types.ts';

export const spec: DemoSpec = {
  props: [
    {
      kind: 'enum',
      name: 'orientation',
      label: 'orientation',
      options: ['horizontal', 'vertical'],
      default: 'horizontal',
    },
    { kind: 'boolean', name: 'decorative', label: 'decorative (role="none")', default: false },
    {
      kind: 'enum',
      name: 'variant',
      label: 'Style',
      options: ['default', 'subtle', 'strong'],
      default: 'default',
    },
  ],
  keys: [],
  uncontrolled: 'Stateless: the props panel sets the orientation and whether it is announced.',
  controlled: 'The orientation lives in your state; a button outside flips it.',
  code: (v) => `<script lang="ts">
  import { SeparatorRoot } from '@texuli/primitives/separator';
${SCRIPT_END}

<p>Account</p>
<SeparatorRoot${attr('orientation', String(v.orientation), 'horizontal')}${attr('decorative', v.decorative === true, false)} />
<p>Billing</p>
${recipeLine('separatorClass', 'texuli/separator-aspect', { orientation: String(v.orientation), variant: String(v.variant) })}`,
  controlCheck: {
    act: '[data-demo-act="flip"]',
    expect: {
      selector: '[data-demo-part="SeparatorRoot"]',
      attribute: 'data-orientation',
      value: 'vertical',
    },
  },
};
</script>

<script lang="ts">
import { SeparatorRoot } from '@texuli/primitives/separator';
import { Button } from 'texuli/button';
import { separatorClass } from 'texuli/separator-aspect';
import { bool, type DemoProps, str } from '../types.ts';

let { values, mode }: DemoProps = $props();

const VARIANTS = ['default', 'subtle', 'strong'] as const;
const variant = $derived(VARIANTS.find((entry) => entry === str(values, 'variant')) ?? 'default');
const decorative = $derived(bool(values, 'decorative'));

let flipped = $state<'horizontal' | 'vertical'>('horizontal');
const orientation = $derived(
  mode === 'controlled'
    ? flipped
    : str(values, 'orientation', 'horizontal') === 'vertical'
      ? 'vertical'
      : 'horizontal'
);
</script>

<div class="demo-separator" data-orientation={orientation}>
  <span>Account</span>
  <SeparatorRoot {orientation} {decorative} class={separatorClass({ orientation, variant })} data-tx-separator="" data-variant={variant} data-demo-part="SeparatorRoot" />
  <span>Billing</span>
  <SeparatorRoot {orientation} {decorative} class={separatorClass({ orientation, variant })} data-tx-separator="" data-variant={variant} data-demo-part="SeparatorRoot" />
  <span>Security</span>
</div>

{#if mode === 'controlled'}
  <div class="demo-controls">
    <output data-demo-readout>orientation: {flipped}</output>
    <Button size="sm" variant="outline" onclick={() => (flipped = flipped === 'horizontal' ? 'vertical' : 'horizontal')} data-demo-act="flip">Flip orientation</Button>
  </div>
{/if}

<style>
  .demo-separator {
    display: grid;
    gap: 0.75rem;
    font-size: 0.875rem;
  }
  .demo-separator[data-orientation='vertical'] {
    display: flex;
    align-items: stretch;
    block-size: 2rem;
  }
  .demo-separator[data-orientation='vertical'] span {
    align-self: center;
  }
</style>
