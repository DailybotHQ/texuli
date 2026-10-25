<script lang="ts" module>
import { attr, type DemoSpec, SCRIPT_END } from '../types.ts';

export const spec: DemoSpec = {
  props: [
    {
      kind: 'enum',
      name: 'direction',
      label: 'direction',
      options: ['horizontal', 'vertical'],
      default: 'horizontal',
    },
    {
      kind: 'number',
      name: 'keyboardStep',
      label: 'keyboardStep (%)',
      min: 5,
      max: 25,
      step: 5,
      default: 10,
    },
    { kind: 'boolean', name: 'collapsible', label: 'First pane collapsible', default: true },
    { kind: 'boolean', name: 'disabled', label: 'disabled', default: false },
  ],
  keys: [
    { keys: ['ArrowLeft', 'ArrowRight'], action: 'Resize side-by-side panes (mirrored in RTL)' },
    { keys: ['ArrowUp', 'ArrowDown'], action: 'Resize stacked panes' },
    { keys: ['Home', 'End'], action: 'Make the first pane its smallest or largest' },
    { keys: ['Enter'], action: 'Collapse or restore a collapsible pane' },
  ],
  uncontrolled: 'Panes start at their defaultSize (30 / 70); the splitter keeps its own layout.',
  controlled: 'bind:layout keeps the sizes in your state, so buttons outside can restore a layout.',
  code: (v) => `<script lang="ts">
  import { Splitter } from '@texuli/primitives/splitter';
  let layout = $state([30, 70]);
${SCRIPT_END}

<Splitter.Root${attr('direction', String(v.direction), 'horizontal')} bind:layout${attr('keyboardStep', v.keyboardStep as number, 10)}${attr('disabled', v.disabled === true, false)}>
  <Splitter.Pane defaultSize={30} minSize={20}${v.collapsible ? ' collapsible collapsedSize={0}' : ''}>Folders</Splitter.Pane>
  <Splitter.Handle label="Resize folders" />
  <Splitter.Pane defaultSize={70} minSize={30}>Messages</Splitter.Pane>
</Splitter.Root>`,
  keyCheck: {
    focus: '[data-demo-part="Splitter.Handle"]',
    press: 'Home',
    expect: {
      selector: '[data-demo-part="Splitter.Handle"]',
      attribute: 'aria-valuenow',
      value: '20',
    },
  },
  controlCheck: {
    act: '[data-demo-act="even"]',
    expect: {
      selector: '[data-demo-part="Splitter.Handle"]',
      attribute: 'aria-valuenow',
      value: '50',
    },
  },
};
</script>

<script lang="ts">
import { Splitter } from '@texuli/primitives/splitter';
import { Button } from 'texuli/button';
import { resizableGroupClass, resizableHandleClass, resizablePanelClass } from 'texuli/resizable';
import { bool, type DemoProps, num, str } from '../types.ts';

let { values, mode }: DemoProps = $props();

const direction = $derived(str(values, 'direction', 'horizontal') === 'vertical' ? 'vertical' : 'horizontal');
const keyboardStep = $derived(num(values, 'keyboardStep', 10));
const collapsible = $derived(bool(values, 'collapsible', true));
const disabled = $derived(bool(values, 'disabled'));
const groupClass = resizableGroupClass({ variant: 'bordered' });
const handleClass = resizableHandleClass({ size: 'md' });
const paneClass = resizablePanelClass();

let layout = $state<number[]>([30, 70]);
const readout = $derived(layout.map((size) => `${Math.round(size)}%`).join(' / '));
</script>

{#snippet panes()}
  <Splitter.Pane defaultSize={30} minSize={20} {collapsible} collapsedSize={0} class={paneClass} data-demo-part="Splitter.Pane">
    <div class="demo-pane"><strong>Folders</strong><span>Inbox, Archive, Drafts</span></div>
  </Splitter.Pane>
  <Splitter.Handle label="Resize folders" class={handleClass} data-tx-resizable-handle="" data-demo-part="Splitter.Handle" />
  <Splitter.Pane defaultSize={70} minSize={30} class={paneClass} data-demo-part="Splitter.Pane">
    <div class="demo-pane"><strong>Messages</strong><span>From ada@example.com: harbor schedule</span></div>
  </Splitter.Pane>
{/snippet}

{#if mode === 'uncontrolled'}
  {#key `${direction}-${collapsible}`}
    <Splitter.Root {direction} {keyboardStep} {disabled} class={groupClass} data-tx-resizable="" data-demo-part="Splitter.Root">
      {@render panes()}
    </Splitter.Root>
  {/key}
{:else}
  {#key `${direction}-${collapsible}`}
    <Splitter.Root {direction} bind:layout {keyboardStep} {disabled} class={groupClass} data-tx-resizable="" data-demo-part="Splitter.Root">
      {@render panes()}
    </Splitter.Root>
  {/key}
  <div class="demo-controls">
    <output data-demo-readout>Layout: {readout}</output>
    <Button size="sm" variant="outline" onclick={() => (layout = [50, 50])} data-demo-act="even">Even split</Button>
    <Button size="sm" variant="ghost" onclick={() => (layout = [30, 70])}>Restore 30 / 70</Button>
  </div>
{/if}

<style>
  .demo-pane {
    display: grid;
    gap: 0.25rem;
    padding: 0.75rem;
    font-size: 0.875rem;
    overflow-wrap: anywhere;
  }
</style>
