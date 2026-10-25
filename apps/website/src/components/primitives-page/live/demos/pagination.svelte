<script lang="ts" module>
import { attr, type DemoSpec, recipeLine, SCRIPT_END } from '../types.ts';

export const spec: DemoSpec = {
  props: [
    {
      kind: 'number',
      name: 'pageCount',
      label: 'pageCount',
      min: 1,
      max: 40,
      step: 1,
      default: 12,
    },
    { kind: 'number', name: 'siblings', label: 'siblings', min: 0, max: 3, step: 1, default: 1 },
    {
      kind: 'enum',
      name: 'variant',
      label: 'Style',
      options: ['outline', 'soft'],
      default: 'outline',
    },
    { kind: 'boolean', name: 'disabled', label: 'disabled', default: false },
  ],
  keys: [
    { keys: ['Tab'], action: 'Move between the page buttons' },
    { keys: ['Enter', ' '], action: 'Go to the focused page' },
  ],
  uncontrolled: 'A plain page (no binding) starts on page 3; pagination keeps its own page.',
  controlled: 'bind:page keeps the current page in your state, so buttons outside can move it.',
  code: (v) => `<script lang="ts">
  import { Pagination } from '@texuli/primitives/pagination';
  let page = $state(3);
${SCRIPT_END}

<Pagination.Root bind:page pageCount={${v.pageCount}}${attr('siblings', v.siblings as number, 1)}${attr('disabled', v.disabled === true, false)} label="Result pages">
  {#snippet children({ pages })}
    <ul>
      <li><Pagination.PreviousButton /></li>
      {#each pages as token (token)}
        <li>
          {#if typeof token === 'number'}
            <Pagination.Page page={token}>{token}</Pagination.Page>
          {:else}
            <Pagination.Ellipsis />
          {/if}
        </li>
      {/each}
      <li><Pagination.NextButton /></li>
    </ul>
  {/snippet}
</Pagination.Root>

${recipeLine('paginationClass', 'texuli/navigation', { variant: v.variant ?? 'outline' })}`,
  keyCheck: {
    focus: '[data-demo-part="Pagination.Page"][aria-label="Page 4"]',
    press: 'Enter',
    expect: {
      selector: '[data-demo-part="Pagination.Page"][aria-label="Page 4"]',
      attribute: 'aria-current',
      value: 'page',
    },
  },
  controlCheck: {
    act: '[data-demo-act="first"]',
    expect: {
      selector: '[data-demo-part="Pagination.Page"][aria-label="Page 1"]',
      attribute: 'aria-current',
      value: 'page',
    },
  },
};
</script>

<script lang="ts">
import { type PageToken, Pagination } from '@texuli/primitives/pagination';
import { Button } from 'texuli/button';
import {
  paginationButtonClass,
  paginationClass,
  paginationEllipsisClass,
  paginationItemClass,
  paginationListClass,
} from 'texuli/navigation';
import { bool, type DemoProps, num, str } from '../types.ts';

let { values, mode }: DemoProps = $props();

const pageCount = $derived(num(values, 'pageCount', 12));
const siblings = $derived(num(values, 'siblings', 1));
const variant = $derived(str(values, 'variant', 'outline') === 'soft' ? 'soft' : 'outline');
const disabled = $derived(bool(values, 'disabled'));
const rootClass = $derived(paginationClass({ variant }));

let page = $state(3);
</script>

{#snippet body({ pages }: { pages: PageToken[] })}
  <ul class={paginationListClass()}>
    <li class={paginationItemClass()}>
      <Pagination.PreviousButton class={paginationButtonClass()} data-demo-part="Pagination.PreviousButton" />
    </li>
    {#each pages as token (token)}
      <li class={paginationItemClass()}>
        {#if typeof token === 'number'}
          <Pagination.Page page={token} class={paginationButtonClass()} data-demo-part="Pagination.Page">{token}</Pagination.Page>
        {:else}
          <Pagination.Ellipsis class={paginationEllipsisClass()} data-demo-part="Pagination.Ellipsis" />
        {/if}
      </li>
    {/each}
    <li class={paginationItemClass()}>
      <Pagination.NextButton class={paginationButtonClass()} data-demo-part="Pagination.NextButton" />
    </li>
  </ul>
{/snippet}

{#if mode === 'uncontrolled'}
  <Pagination.Root page={3} {pageCount} {siblings} {disabled} label="Result pages, uncontrolled" class={rootClass} data-tx-pagination="" data-variant={variant} data-demo-part="Pagination.Root">
    {#snippet children(ctx)}
      {@render body(ctx)}
    {/snippet}
  </Pagination.Root>
{:else}
  <Pagination.Root bind:page {pageCount} {siblings} {disabled} label="Result pages, controlled" class={rootClass} data-tx-pagination="" data-variant={variant} data-demo-part="Pagination.Root">
    {#snippet children(ctx)}
      {@render body(ctx)}
    {/snippet}
  </Pagination.Root>
  <div class="demo-controls">
    <output data-demo-readout>Page {Math.min(page, pageCount)} of {pageCount}</output>
    <Button size="sm" variant="outline" onclick={() => (page = 1)} data-demo-act="first">First page</Button>
    <Button size="sm" variant="ghost" onclick={() => (page = pageCount)}>Last page</Button>
  </div>
{/if}
