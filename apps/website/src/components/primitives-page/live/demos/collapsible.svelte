<script lang="ts" module>
import { attr, type DemoSpec, SCRIPT_END } from '../types.ts';

export const spec: DemoSpec = {
  props: [
    { kind: 'string', name: 'label', label: 'Trigger text', default: 'Show shipping details' },
    { kind: 'boolean', name: 'disabled', label: 'disabled', default: false },
  ],
  keys: [
    { keys: ['Enter', ' '], action: 'Show or hide the content' },
    { keys: ['Tab'], action: 'Move into the content when it is shown (hidden content is inert)' },
  ],
  uncontrolled: 'defaultOpen={false}: the collapsible keeps its own open state.',
  controlled: 'bind:open puts the open state in your hands; the buttons below change it.',
  code: (v) => `<script lang="ts">
  import {
    CollapsibleContent,
    CollapsibleRoot,
    CollapsibleTrigger,
  } from '@texuli/primitives/collapsible';
  let open = $state(false);
${SCRIPT_END}

<CollapsibleRoot bind:open${attr('disabled', v.disabled === true, false)}>
  <CollapsibleTrigger>${v.label}</CollapsibleTrigger>
  <CollapsibleContent>
    <p>Orders ship within two days.</p>
  </CollapsibleContent>
</CollapsibleRoot>`,
  keyCheck: {
    focus: '[data-demo-part="CollapsibleTrigger"]',
    press: 'Enter',
    expect: {
      selector: '[data-demo-part="CollapsibleTrigger"]',
      attribute: 'aria-expanded',
      value: 'true',
    },
  },
  controlCheck: {
    act: '[data-demo-act="open"]',
    expect: {
      selector: '[data-demo-part="CollapsibleTrigger"]',
      attribute: 'aria-expanded',
      value: 'true',
    },
  },
};
</script>

<script lang="ts">
import {
  CollapsibleContent,
  CollapsibleRoot,
  CollapsibleTrigger,
} from '@texuli/primitives/collapsible';
import { Button } from 'texuli/button';
import { Icon } from 'texuli/icons';
// The collapsible styles ship with the tabs-accordion entry.
import 'texuli/tabs-accordion';
import { bool, type DemoProps, str } from '../types.ts';

let { values, mode }: DemoProps = $props();

const label = $derived(str(values, 'label') || 'Show shipping details');
const disabled = $derived(bool(values, 'disabled'));

let open = $state(false);
</script>

<!--
  CollapsibleRoot and CollapsibleContent take only `class` (no attribute
  spread), so the anatomy markers sit on a wrapper and on the content body.
-->
{#snippet parts()}
  <CollapsibleTrigger class="tx-collapsible__trigger" data-demo-part="CollapsibleTrigger">
    {label}
    <Icon icon="chevron-down" size="sm" class="tx-collapsible__chevron" aria-hidden="true" />
  </CollapsibleTrigger>
  <CollapsibleContent class="tx-collapsible__content">
    <div data-demo-part="CollapsibleContent">
      <p>Orders ship within two days. Tracking links go to the address on file (orders@example.com).</p>
    </div>
  </CollapsibleContent>
{/snippet}

{#if mode === 'uncontrolled'}
  <div data-demo-part="CollapsibleRoot">
    <CollapsibleRoot defaultOpen={false} {disabled} class="tx-collapsible">
      {@render parts()}
    </CollapsibleRoot>
  </div>
{:else}
  <div data-demo-part="CollapsibleRoot">
    <CollapsibleRoot bind:open {disabled} class="tx-collapsible">
      {@render parts()}
    </CollapsibleRoot>
  </div>
  <div class="demo-controls">
    <output data-demo-readout>open: {open}</output>
    <Button size="sm" variant="outline" onclick={() => (open = true)} data-demo-act="open">Open</Button>
    <Button size="sm" variant="ghost" onclick={() => (open = false)}>Close</Button>
  </div>
{/if}
