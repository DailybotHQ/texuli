<script lang="ts" module>
import { attr, type DemoSpec, SCRIPT_END } from '../types.ts';

export const spec: DemoSpec = {
  props: [{ kind: 'boolean', name: 'disabled', label: 'disabled', default: false }],
  keys: [],
  uncontrolled: 'A fixed target: the note is written here but rendered inside the "Board" box.',
  controlled: 'The target lives in your state, so buttons outside move the note between boxes.',
  code: (v) => `<script lang="ts">
  import { Portal } from '@texuli/primitives/portal';
  let board = $state<HTMLElement>();
  let archive = $state<HTMLElement>();
  let target = $state<'board' | 'archive'>('board');
${SCRIPT_END}

<div bind:this={board}></div>
<div bind:this={archive}></div>

{#if board && archive}
  <Portal to={target === 'board' ? board : archive}${attr('disabled', v.disabled === true, false)}>
    <p>Release notes are due Friday.</p>
  </Portal>
{/if}`,
  controlCheck: {
    act: '[data-demo-act="archive"]',
    expect: { selector: '[data-demo-target="archive"] [data-demo-part="Portal"]', count: 1 },
  },
};
</script>

<script lang="ts">
import { Portal } from '@texuli/primitives/portal';
import { Badge } from 'texuli/badge';
import { Button } from 'texuli/button';
import { bool, type DemoProps } from '../types.ts';

let { values, mode }: DemoProps = $props();

const disabled = $derived(bool(values, 'disabled'));

let board = $state<HTMLElement>();
let archive = $state<HTMLElement>();
let target = $state<'board' | 'archive'>('board');
const to = $derived(mode === 'uncontrolled' || target === 'board' ? board : archive);
</script>

<div class="demo-portal__boxes">
  <div class="demo-portal__box">
    <span class="demo-portal__caption">Board</span>
    <div class="demo-portal__target" bind:this={board} data-demo-target="board"></div>
  </div>
  <div class="demo-portal__box">
    <span class="demo-portal__caption">Archive</span>
    <div class="demo-portal__target" bind:this={archive} data-demo-target="archive"></div>
  </div>
</div>

<div class="demo-portal__source">
  <span class="demo-portal__caption">Written here{disabled ? ' (portal disabled: rendered in place)' : ''}</span>
  {#if to}
    <Portal {to} {disabled}>
      <p class="demo-portal__note" data-demo-part="Portal">
        <Badge variant="info">Note</Badge>
        Release notes are due Friday.
      </p>
    </Portal>
  {/if}
</div>

{#if mode === 'controlled'}
  <div class="demo-controls">
    <output data-demo-readout>Target: {target}</output>
    <Button size="sm" variant="outline" onclick={() => (target = 'archive')} data-demo-act="archive">Move to Archive</Button>
    <Button size="sm" variant="ghost" onclick={() => (target = 'board')}>Move to Board</Button>
  </div>
{/if}

<style>
  .demo-portal__boxes {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 8rem), 1fr));
    gap: 0.5rem;
  }
  .demo-portal__box,
  .demo-portal__source {
    display: grid;
    gap: 0.375rem;
    padding: 0.5rem;
    border: 1px solid var(--tx-border);
    border-radius: 0.375rem;
  }
  .demo-portal__target {
    min-block-size: 3rem;
  }
  .demo-portal__caption {
    font-size: 0.75rem;
    color: var(--tx-muted-foreground);
  }
  .demo-portal__note {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.375rem;
    margin: 0;
    font-size: 0.875rem;
  }
</style>
