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
    { kind: 'enum', name: 'size', label: 'Style size', options: ['sm', 'md', 'lg'], default: 'md' },
    {
      kind: 'number',
      name: 'delayDuration',
      label: 'delayDuration (ms)',
      min: 0,
      max: 800,
      step: 100,
      default: 200,
    },
    { kind: 'boolean', name: 'viewport', label: 'Shared Viewport', default: false },
  ],
  keys: [
    {
      keys: ['ArrowRight', 'ArrowLeft'],
      action: 'Next or previous top-level item (horizontal; swapped in right to left)',
    },
    { keys: ['Home', 'End'], action: 'First or last top-level item' },
    { keys: ['Enter', ' '], action: 'Open or close the focused section' },
    { keys: ['ArrowDown', 'Tab'], action: 'From an open trigger: move into its links' },
    { keys: ['Escape'], action: 'Close the open section and focus its trigger' },
  ],
  uncontrolled:
    'No binding: the menu opens a section on click, focus or hover (after delayDuration).',
  controlled:
    'bind:value holds the open section ("" when closed); link clicks are kept on this page with onSelect.',
  code: (v) => `<script lang="ts">
  import { NavigationMenu } from '@texuli/primitives/navigation-menu';
  let value = $state('');
${SCRIPT_END}

<NavigationMenu.Root aria-label="Main" bind:value${attr('orientation', String(v.orientation), 'horizontal')}${attr('delayDuration', Number(v.delayDuration), 200)}>
  <NavigationMenu.List>
    <NavigationMenu.Item value="products">
      <NavigationMenu.Trigger>Products</NavigationMenu.Trigger>
      <NavigationMenu.Content>
        <NavigationMenu.Link href="https://example.com/analytics">Analytics</NavigationMenu.Link>
      </NavigationMenu.Content>
    </NavigationMenu.Item>
    <NavigationMenu.Item value="pricing">
      <NavigationMenu.Link href="https://example.com/pricing" active>Pricing</NavigationMenu.Link>
    </NavigationMenu.Item>
    <NavigationMenu.Indicator />
  </NavigationMenu.List>${v.viewport === true ? '\n  <NavigationMenu.Viewport />' : ''}
</NavigationMenu.Root>

${recipeLine('navigationMenuClass', 'texuli/navigation', { size: v.size ?? 'md' })}`,
  keyCheck: {
    focus: '[data-demo-part="NavigationMenu.Trigger"][data-section="products"]',
    press: 'ArrowRight',
    expect: {
      selector: '[data-demo-part="NavigationMenu.Trigger"][data-section="docs"]:focus',
      count: 1,
    },
  },
  controlCheck: {
    act: '[data-demo-act="docs"]',
    expect: {
      selector: '[data-demo-part="NavigationMenu.Trigger"][data-section="docs"]',
      attribute: 'aria-expanded',
      value: 'true',
    },
  },
};
</script>

<script lang="ts">
import { NavigationMenu } from '@texuli/primitives/navigation-menu';
import { Button } from 'texuli/button';
import {
  type NavSize,
  navigationMenuClass,
  navigationMenuContentClass,
  navigationMenuIndicatorClass,
  navigationMenuItemClass,
  navigationMenuLinkClass,
  navigationMenuListClass,
  navigationMenuTriggerClass,
  navigationMenuViewportClass,
} from 'texuli/navigation';
import { bool, type DemoProps, num, str } from '../types.ts';

let { values, mode, dir }: DemoProps = $props();

const SECTIONS = [
  {
    value: 'products',
    label: 'Products',
    links: [
      { href: 'https://example.com/analytics', label: 'Analytics' },
      { href: 'https://example.com/automation', label: 'Automation' },
    ],
  },
  {
    value: 'docs',
    label: 'Docs',
    links: [
      { href: 'https://example.com/guides', label: 'Guides' },
      { href: 'https://example.com/api', label: 'API reference' },
    ],
  },
];

const orientation = $derived(str(values, 'orientation', 'horizontal') === 'vertical' ? 'vertical' : 'horizontal');
const size = $derived<NavSize>(
  (['sm', 'md', 'lg'] as const).find((s) => s === str(values, 'size', 'md')) ?? 'md'
);
const delayDuration = $derived(num(values, 'delayDuration', 200));
const viewport = $derived(bool(values, 'viewport'));
const rootClass = $derived(navigationMenuClass({ size }));

let value = $state('');
let last = $state('nothing yet');

function keepHere(event: MouseEvent, label: string): void {
  // The demo stays on this page: record the choice instead of navigating.
  event.preventDefault();
  last = label;
}
</script>

{#snippet list()}
  <NavigationMenu.List class={navigationMenuListClass()} data-demo-part="NavigationMenu.List">
    {#each SECTIONS as section (section.value)}
      <NavigationMenu.Item value={section.value} class={navigationMenuItemClass()} data-demo-part="NavigationMenu.Item">
        <NavigationMenu.Trigger class={navigationMenuTriggerClass()} data-section={section.value} data-demo-part="NavigationMenu.Trigger">
          {section.label}
          <svg class="tx-nav-menu__trigger-chevron" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
            <path d="M4.5 6.25 8 9.75l3.5-3.5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </NavigationMenu.Trigger>
        <div data-tx-nav-menu-content class="tx-nav-menu__content-host">
          <NavigationMenu.Content class={navigationMenuContentClass()}>
            <div class="demo-nav-links" data-demo-part="NavigationMenu.Content">
              {#each section.links as link (link.href)}
                <NavigationMenu.Link href={link.href} class={navigationMenuLinkClass()} data-demo-part="NavigationMenu.Link" onSelect={(event) => keepHere(event, link.label)}>
                  {link.label}
                </NavigationMenu.Link>
              {/each}
            </div>
          </NavigationMenu.Content>
        </div>
      </NavigationMenu.Item>
    {/each}
    <NavigationMenu.Item value="pricing" class={navigationMenuItemClass()} data-demo-part="NavigationMenu.Item">
      <NavigationMenu.Link href="https://example.com/pricing" active class={navigationMenuLinkClass({ active: true })} data-demo-part="NavigationMenu.Link" onSelect={(event) => keepHere(event, 'Pricing')}>
        Pricing
      </NavigationMenu.Link>
    </NavigationMenu.Item>
    <NavigationMenu.Indicator class={navigationMenuIndicatorClass()} data-demo-part="NavigationMenu.Indicator" />
  </NavigationMenu.List>
  {#if viewport}
    <NavigationMenu.Viewport class={navigationMenuViewportClass()} data-demo-part="NavigationMenu.Viewport" />
  {/if}
{/snippet}

{#if mode === 'uncontrolled'}
  {#key viewport}
    <NavigationMenu.Root aria-label="Product site" {orientation} {delayDuration} {dir} class={rootClass} data-size={size} data-demo-part="NavigationMenu.Root">
      {@render list()}
    </NavigationMenu.Root>
  {/key}
{:else}
  {#key viewport}
    <NavigationMenu.Root aria-label="Help center" bind:value {orientation} {delayDuration} {dir} class={rootClass} data-size={size} data-demo-part="NavigationMenu.Root">
      {@render list()}
    </NavigationMenu.Root>
  {/key}
  <div class="demo-controls">
    <output data-demo-readout>value: "{value}" · last link: {last}</output>
    <Button size="sm" variant="outline" onclick={() => (value = 'docs')} data-demo-act="docs">Open Docs</Button>
    <Button size="sm" variant="ghost" onclick={() => (value = '')}>Close</Button>
  </div>
{/if}

<style>
  .demo-nav-links {
    display: grid;
    gap: 0.125rem;
  }
</style>
