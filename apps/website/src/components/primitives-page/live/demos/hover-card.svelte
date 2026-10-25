<script lang="ts" module>
import { attr, type DemoSpec, recipeLine, SCRIPT_END } from '../types.ts';

export const spec: DemoSpec = {
  props: [
    {
      kind: 'number',
      name: 'openDelay',
      label: 'openDelay (ms)',
      min: 0,
      max: 1000,
      step: 100,
      default: 300,
    },
    {
      kind: 'number',
      name: 'closeDelay',
      label: 'closeDelay (ms)',
      min: 0,
      max: 1000,
      step: 100,
      default: 200,
    },
    {
      kind: 'enum',
      name: 'variant',
      label: 'Style',
      options: ['elevated', 'flat'],
      default: 'elevated',
    },
    { kind: 'boolean', name: 'arrow', label: 'Arrow', default: true },
  ],
  keys: [
    { keys: ['Tab'], action: 'Focus a trigger: its card opens after openDelay' },
    { keys: ['Escape'], action: 'Close the open card' },
  ],
  uncontrolled: 'No binding: hover or focus a name and the card opens after the delay.',
  controlled: 'bind:open keeps the state in yours, so a button outside can show the card.',
  code: (v) => `<script lang="ts">
  import { HoverCardContent, HoverCardRoot, HoverCardTrigger } from '@texuli/primitives/hover-card';
  let open = $state(false);
${SCRIPT_END}

<HoverCardRoot bind:open${attr('openDelay', Number(v.openDelay), 500)}${attr('closeDelay', Number(v.closeDelay), 300)}>
  <HoverCardTrigger>Sam Chen</HoverCardTrigger>
  <HoverCardContent aria-label="Sam Chen profile">
${v.arrow !== false ? '    <span class={hoverCardArrowClass()} aria-hidden="true"></span>\n' : ''}    Product designer · sam@example.com
  </HoverCardContent>
</HoverCardRoot>

${recipeLine('hoverCardContentClass', 'texuli/popover', { variant: v.variant ?? 'elevated', size: 'sm' })}`,
  keyCheck: {
    focus: '[data-demo-part="HoverCardTrigger"][data-person="sam"]',
    press: 'Tab',
    expect: {
      selector: '[data-demo-part="HoverCardTrigger"][data-person="rio"]',
      attribute: 'aria-expanded',
      value: 'true',
    },
  },
  controlCheck: {
    act: '[data-demo-act="show"]',
    expect: {
      selector: '[data-demo-part="HoverCardContent"]',
      attribute: 'data-state',
      value: 'open',
    },
  },
};
</script>

<script lang="ts">
import { HoverCardContent, HoverCardRoot, HoverCardTrigger } from '@texuli/primitives/hover-card';
import { Button } from 'texuli/button';
import { hoverCardArrowClass, hoverCardContentClass, hoverCardTriggerClass } from 'texuli/popover';
import { bool, type DemoProps, num, str } from '../types.ts';

let { values, mode }: DemoProps = $props();

const PEOPLE = [
  { id: 'sam', name: 'Sam Chen', role: 'Product designer', email: 'sam@example.com' },
  { id: 'rio', name: 'Rio Park', role: 'Support lead', email: 'rio@example.com' },
];

const openDelay = $derived(num(values, 'openDelay', 300));
const closeDelay = $derived(num(values, 'closeDelay', 200));
const variant = $derived(str(values, 'variant', 'elevated') === 'flat' ? 'flat' : 'elevated');
const arrow = $derived(bool(values, 'arrow', true));
const contentClass = $derived(hoverCardContentClass({ variant, size: 'sm' }));

let open = $state(false);
</script>

{#snippet card(person: (typeof PEOPLE)[number])}
  <HoverCardTrigger class={hoverCardTriggerClass()} data-tx-hover-card-trigger data-demo-part="HoverCardTrigger" data-person={person.id}>
    {person.name}
  </HoverCardTrigger>
  <HoverCardContent class={contentClass} data-tx-hover-card-content data-variant={variant} data-size="sm" aria-label="{person.name} profile" data-demo-part="HoverCardContent">
    {#if arrow}
      <span class={hoverCardArrowClass()} data-tx-hover-card-arrow aria-hidden="true"></span>
    {/if}
    <strong>{person.name}</strong>
    <span>{person.role} · {person.email}</span>
  </HoverCardContent>
{/snippet}

{#if mode === 'uncontrolled'}
  <p>
    Assigned to
    {#each PEOPLE as person, index (person.id)}
      {#if index > 0}<span> by </span>{/if}
      <HoverCardRoot {openDelay} {closeDelay}>
        {@render card(person)}
      </HoverCardRoot>
    {/each}
  </p>
{:else}
  <p>
    Reviewer:
    <HoverCardRoot bind:open {openDelay} {closeDelay}>
      {@render card(PEOPLE[0] as (typeof PEOPLE)[number])}
    </HoverCardRoot>
  </p>
  <div class="demo-controls">
    <output data-demo-readout>open: {open}</output>
    <Button size="sm" variant="outline" onclick={() => (open = true)} data-demo-act="show">Show card</Button>
    <Button size="sm" variant="ghost" onclick={() => (open = false)}>Hide card</Button>
  </div>
{/if}
