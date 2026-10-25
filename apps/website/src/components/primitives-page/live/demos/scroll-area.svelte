<script lang="ts" module>
import { attr, type DemoSpec, recipeLine, SCRIPT_END } from '../types.ts';

export const spec: DemoSpec = {
  props: [
    {
      kind: 'enum',
      name: 'type',
      label: 'type',
      options: ['hover', 'scroll', 'auto', 'always'],
      default: 'always',
    },
    { kind: 'enum', name: 'size', label: 'Height', options: ['sm', 'md', 'lg'], default: 'sm' },
    {
      kind: 'number',
      name: 'scrollHideDelay',
      label: 'scrollHideDelay (ms)',
      min: 0,
      max: 2000,
      step: 100,
      default: 600,
    },
  ],
  keys: [
    {
      keys: ['ArrowDown', 'ArrowUp'],
      action: 'Scroll the focused viewport a line (native scrolling)',
    },
    { keys: ['PageDown', 'PageUp'], action: 'Scroll a page' },
    { keys: ['Home', 'End'], action: 'Jump to the top or the bottom' },
  ],
  uncontrolled:
    'The viewport scrolls natively; the custom scrollbar mirrors it and can be dragged.',
  controlled: 'Your code drives the scroll position: buttons outside jump to the top or bottom.',
  code: (v) => `<script lang="ts">
  import { ScrollArea } from '@texuli/primitives/scroll-area';
${SCRIPT_END}

<ScrollArea.Root type="${v.type}"${attr('scrollHideDelay', v.scrollHideDelay as number, 600)} role="region" aria-label="Inbox">
  <ScrollArea.Viewport>
    <ul>{#each messages as message (message)}<li>{message}</li>{/each}</ul>
  </ScrollArea.Viewport>
  <ScrollArea.Scrollbar orientation="vertical">
    <ScrollArea.Thumb />
  </ScrollArea.Scrollbar>
  <ScrollArea.Corner />
</ScrollArea.Root>
${recipeLine('scrollAreaVariants', 'texuli/scroll-area', { size: String(v.size) })}`,
  keyCheck: {
    focus: '[data-demo-part="ScrollArea.Viewport"]',
    press: 'End',
    expect: {
      selector: '[data-demo-part="ScrollArea.Viewport"]',
      attribute: 'data-scroll-edge',
      value: 'bottom',
    },
  },
  controlCheck: {
    act: '[data-demo-act="bottom"]',
    expect: {
      selector: '[data-demo-part="ScrollArea.Viewport"]',
      attribute: 'data-scroll-edge',
      value: 'bottom',
    },
  },
};
</script>

<script lang="ts">
import { ScrollArea } from '@texuli/primitives/scroll-area';
import { Button } from 'texuli/button';
import { scrollAreaVariants } from 'texuli/scroll-area';
import { type DemoProps, num, str } from '../types.ts';

let { values, mode, dir }: DemoProps = $props();

const TYPES = ['hover', 'scroll', 'auto', 'always'] as const;
const SIZES = ['sm', 'md', 'lg'] as const;
const type = $derived(TYPES.find((entry) => entry === str(values, 'type')) ?? 'always');
const size = $derived(SIZES.find((entry) => entry === str(values, 'size')) ?? 'sm');
const scrollHideDelay = $derived(num(values, 'scrollHideDelay', 600));
const viewportId = $derived(`demo-scroll-${mode}`);

const MESSAGES = Array.from(
  { length: 24 },
  (_, index) => `Message ${index + 1} from crew${(index % 5) + 1}@example.com`
);

let edge = $state<'top' | 'middle' | 'bottom'>('top');

function onScroll(event: Event): void {
  const node = event.currentTarget as HTMLElement;
  const bottom = node.scrollTop + node.clientHeight >= node.scrollHeight - 2;
  edge = node.scrollTop <= 1 ? 'top' : bottom ? 'bottom' : 'middle';
}

function jump(to: 'top' | 'bottom'): void {
  const node = document.getElementById(viewportId);
  node?.scrollTo({ top: to === 'top' ? 0 : node.scrollHeight });
}
</script>

<ScrollArea.Root {type} {dir} {scrollHideDelay} class={scrollAreaVariants({ size })} role="region" aria-label="Inbox, {mode}" data-demo-part="ScrollArea.Root">
  <ScrollArea.Viewport id={viewportId} class="tx-scroll-area__viewport" onscroll={onScroll} data-scroll-edge={edge} data-demo-part="ScrollArea.Viewport">
    <ul class="demo-scroll__list">
      {#each MESSAGES as message (message)}
        <li>{message}</li>
      {/each}
    </ul>
  </ScrollArea.Viewport>
  <ScrollArea.Scrollbar orientation="vertical" class="tx-scroll-area__scrollbar" data-demo-part="ScrollArea.Scrollbar">
    <ScrollArea.Thumb class="tx-scroll-area__thumb" data-demo-part="ScrollArea.Thumb" />
  </ScrollArea.Scrollbar>
  <ScrollArea.Corner data-demo-part="ScrollArea.Corner" />
</ScrollArea.Root>

{#if mode === 'controlled'}
  <div class="demo-controls">
    <output data-demo-readout>Position: {edge}</output>
    <Button size="sm" variant="outline" onclick={() => jump('bottom')} data-demo-act="bottom">Scroll to bottom</Button>
    <Button size="sm" variant="ghost" onclick={() => jump('top')}>Scroll to top</Button>
  </div>
{/if}

<style>
  .demo-scroll__list {
    margin: 0;
    padding: 0.25rem 0.75rem;
    list-style: none;
    font-size: 0.875rem;
  }
  .demo-scroll__list li {
    padding-block: 0.375rem;
    border-block-end: 1px solid var(--tx-border);
  }
</style>
