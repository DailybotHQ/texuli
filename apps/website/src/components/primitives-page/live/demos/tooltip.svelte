<script lang="ts" module>
import { attr, type DemoSpec, SCRIPT_END } from '../types.ts';

export const spec: DemoSpec = {
  props: [
    {
      kind: 'enum',
      name: 'side',
      label: 'side',
      options: ['top', 'right', 'bottom', 'left'],
      default: 'top',
    },
    {
      kind: 'number',
      name: 'delayDuration',
      label: 'delayDuration (ms)',
      min: 0,
      max: 1000,
      step: 100,
      default: 300,
    },
    { kind: 'string', name: 'content', label: 'Tooltip text', default: 'Saves a copy to drafts' },
    { kind: 'boolean', name: 'disabled', label: 'disabled', default: false },
  ],
  keys: [
    { keys: ['Tab'], action: 'Focus the trigger: the tooltip shows at once, no delay' },
    { keys: ['Escape'], action: 'Hide the tooltip and keep focus on the trigger' },
  ],
  uncontrolled: 'The tooltip opens on hover (after the delay) or focus and keeps its own state.',
  controlled: 'bind:open keeps it in your state, so a button outside can show or hide it.',
  code: (v) => `<script lang="ts">
  import { Tooltip } from '@texuli/primitives/tooltip';
  let open = $state(false);
${SCRIPT_END}

<Tooltip.Provider${attr('delayDuration', v.delayDuration as number, 300)}>
  <Tooltip.Root bind:open${attr('disabled', v.disabled === true, false)}>
    <Tooltip.Trigger>Save draft</Tooltip.Trigger>
    <Tooltip.Content${attr('side', String(v.side), 'top')}>${String(v.content)}</Tooltip.Content>
  </Tooltip.Root>
</Tooltip.Provider>`,
  keyCheck: {
    focus: '[data-demo-part="Tooltip.Trigger"]',
    press: 'Escape',
    expect: { selector: '[data-demo-part="Tooltip.Content"]', count: 0 },
  },
  controlCheck: {
    act: '[data-demo-act="show"]',
    expect: { selector: '[data-demo-part="Tooltip.Content"]', count: 1 },
  },
};
</script>

<script lang="ts">
import { Tooltip } from '@texuli/primitives/tooltip';
import { Button, buttonVariants } from 'texuli/button';
import { tooltipContentClass } from 'texuli/tooltip';
import { bool, type DemoProps, num, str } from '../types.ts';

let { values, mode }: DemoProps = $props();

const side = $derived(
  (['top', 'right', 'bottom', 'left'] as const).find((entry) => entry === str(values, 'side')) ?? 'top'
);
const delayDuration = $derived(num(values, 'delayDuration', 300));
const content = $derived(str(values, 'content', 'Saves a copy to drafts').trim() || 'Saves a copy to drafts');
const disabled = $derived(bool(values, 'disabled'));
const contentClass = $derived(tooltipContentClass({ side }));
const triggerClass = buttonVariants({ variant: 'outline', size: 'md' });

let open = $state(false);
</script>

{#snippet body()}
  <Tooltip.Trigger class={triggerClass} data-demo-part="Tooltip.Trigger">Save draft</Tooltip.Trigger>
  <Tooltip.Content {side} class={contentClass} data-tx-tooltip data-demo-part="Tooltip.Content">
    <span class="tx-tooltip__body"><span class="tx-tooltip__text">{content}</span></span>
  </Tooltip.Content>
{/snippet}

<div class="demo-stage">
  <Tooltip.Provider {delayDuration}>
    {#if mode === 'uncontrolled'}
      <Tooltip.Root {disabled}>
        {@render body()}
      </Tooltip.Root>
    {:else}
      <Tooltip.Root bind:open {disabled}>
        {@render body()}
      </Tooltip.Root>
    {/if}
  </Tooltip.Provider>
</div>

{#if mode === 'controlled'}
  <div class="demo-controls">
    <output data-demo-readout>open: {open}</output>
    <Button size="sm" variant="outline" onclick={() => (open = true)} data-demo-act="show">Show tooltip</Button>
    <Button size="sm" variant="ghost" onclick={() => (open = false)} data-demo-act="hide">Hide tooltip</Button>
  </div>
{/if}

<style>
  .demo-stage {
    display: flex;
    justify-content: center;
    padding-block: 2.5rem;
  }
</style>
