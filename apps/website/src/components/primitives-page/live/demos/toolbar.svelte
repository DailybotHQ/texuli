<script lang="ts" module>
import { attr, type DemoSpec, recipeLine, SCRIPT_END } from '../types.ts';

export const spec: DemoSpec = {
  props: [
    {
      kind: 'enum',
      name: 'variant',
      label: 'Style',
      options: ['default', 'outline', 'ghost'],
      default: 'outline',
    },
    { kind: 'enum', name: 'size', label: 'Size', options: ['sm', 'md'], default: 'md' },
    {
      kind: 'enum',
      name: 'orientation',
      label: 'orientation',
      options: ['horizontal', 'vertical'],
      default: 'horizontal',
    },
    { kind: 'boolean', name: 'loop', label: 'loop', default: true },
  ],
  keys: [
    {
      keys: ['ArrowRight', 'ArrowLeft'],
      action: 'Move between controls (horizontal, mirrored in RTL)',
    },
    { keys: ['ArrowDown', 'ArrowUp'], action: 'Move between controls (vertical)' },
    { keys: ['Home', 'End'], action: 'Move to the first or last control' },
    { keys: [' ', 'Enter'], action: 'Press the focused button or format' },
    { keys: ['Tab'], action: 'Leave the toolbar: it is one Tab stop' },
  ],
  uncontrolled:
    'The format group starts with Bold pressed (a plain value) and keeps its own state.',
  controlled: 'bind:value on Toolbar.Group keeps the pressed formats in your state.',
  code: (v) => `<script lang="ts">
  import { Toolbar } from '@texuli/primitives/toolbar';
  let formats = $state(['bold']);
${SCRIPT_END}

<Toolbar.Root aria-label="Formatting"${attr('orientation', String(v.orientation), 'horizontal')}${attr('loop', v.loop === true, true)}>
  <Toolbar.Button onclick={undo}>Undo</Toolbar.Button>
  <Toolbar.Separator />
  <Toolbar.Group type="multiple" bind:value={formats} aria-label="Text format">
    <Toolbar.GroupItem value="bold">Bold</Toolbar.GroupItem>
    <Toolbar.GroupItem value="italic">Italic</Toolbar.GroupItem>
    <Toolbar.GroupItem value="underline">Underline</Toolbar.GroupItem>
  </Toolbar.Group>
  <Toolbar.Separator />
  <Toolbar.Link href="/guides/">Guides</Toolbar.Link>
</Toolbar.Root>
${recipeLine('toolbarRootClass', 'texuli/toolbar', { variant: String(v.variant), size: String(v.size), orientation: String(v.orientation) })}`,
  keyCheck: {
    focus: '[data-demo-part="Toolbar.Button"]',
    press: 'End',
    expect: { selector: '[data-demo-part="Toolbar.Link"]:focus', count: 1 },
  },
  controlCheck: {
    act: '[data-demo-act="italic"]',
    expect: {
      selector: '[data-demo-part="Toolbar.GroupItem"][data-value="italic"]',
      attribute: 'aria-pressed',
      value: 'true',
    },
  },
};
</script>

<script lang="ts">
import { Toolbar } from '@texuli/primitives/toolbar';
import { Button } from 'texuli/button';
import { toolbarButtonClass, toolbarRootClass } from 'texuli/toolbar';
import { bool, type DemoProps, str } from '../types.ts';

let { values, mode }: DemoProps = $props();

const FORMATS = [
  { value: 'bold', label: 'Bold' },
  { value: 'italic', label: 'Italic' },
  { value: 'underline', label: 'Underline' },
];

const variant = $derived(
  (['default', 'outline', 'ghost'] as const).find((entry) => entry === str(values, 'variant')) ?? 'outline'
);
const size = $derived(str(values, 'size') === 'sm' ? 'sm' : 'md');
const orientation = $derived(str(values, 'orientation') === 'vertical' ? 'vertical' : 'horizontal');
const loop = $derived(bool(values, 'loop', true));
const rootClass = $derived(toolbarRootClass({ variant, size, orientation }));
const buttonClass = $derived(toolbarButtonClass({ size }));
const itemClass = $derived(toolbarButtonClass({ size, class: 'tx-toolbar__group-item' }));
const linkClass = $derived(toolbarButtonClass({ size, class: 'tx-toolbar__link' }));

let formats = $state<string[]>(['bold']);
let undone = $state(0);
</script>

{#snippet group()}
  {#each FORMATS as format (format.value)}
    <Toolbar.GroupItem value={format.value} class={itemClass} data-value={format.value} data-demo-part="Toolbar.GroupItem">{format.label}</Toolbar.GroupItem>
  {/each}
{/snippet}

{#key `${orientation}-${loop}`}
  <Toolbar.Root aria-label="Formatting" {orientation} {loop} class={rootClass} data-demo-part="Toolbar.Root">
    <Toolbar.Button class={buttonClass} onclick={() => (undone += 1)} data-demo-part="Toolbar.Button">Undo</Toolbar.Button>
    <Toolbar.Separator class="tx-toolbar__separator" data-demo-part="Toolbar.Separator" />
    {#if mode === 'uncontrolled'}
      <Toolbar.Group type="multiple" value={['bold']} aria-label="Text format" class="tx-toolbar__group" data-demo-part="Toolbar.Group">
        {@render group()}
      </Toolbar.Group>
    {:else}
      <Toolbar.Group type="multiple" bind:value={formats} aria-label="Text format" class="tx-toolbar__group" data-demo-part="Toolbar.Group">
        {@render group()}
      </Toolbar.Group>
    {/if}
    <Toolbar.Separator class="tx-toolbar__separator" data-demo-part="Toolbar.Separator" />
    <Toolbar.Link href="#anatomy-title" class={linkClass} data-demo-part="Toolbar.Link">Anatomy</Toolbar.Link>
  </Toolbar.Root>
{/key}

{#if mode === 'controlled'}
  <div class="demo-controls">
    <output data-demo-readout>Formats: {formats.length ? formats.join(', ') : 'none'} · Undo pressed {undone} times</output>
    <Button size="sm" variant="outline" onclick={() => (formats = [...new Set([...formats, 'italic'])])} data-demo-act="italic">Add italic</Button>
    <Button size="sm" variant="ghost" onclick={() => (formats = [])}>Clear formats</Button>
  </div>
{/if}
