<script lang="ts">
import { Command } from '../../src/command/index.ts';
import type { HarnessProps } from '../support/contract.ts';

let { p, refs, variant = 'list' }: HarnessProps = $props();
let input = $state<HTMLElement | null>(null);
const onSearch = $derived(variant === 'loading' ? () => new Promise<void>(() => {}) : undefined);

// The loading variant types once so a search is pending.
$effect(() => {
  if (variant !== 'loading' || !(input instanceof HTMLInputElement)) return;
  input.value = 'in';
  input.dispatchEvent(new Event('input', { bubbles: true }));
});
</script>

<Command.Root label="Commands" {onSearch} {...p('command/Root')} bind:ref={refs['command/Root']}>
  {#if variant === 'loading'}
    <Command.Input bind:ref={input} />
  {:else}
    <Command.Input {...p('command/Input')} bind:ref={refs['command/Input']} />
  {/if}
  <Command.List {...p('command/List')} bind:ref={refs['command/List']}>
    <Command.Loading {...p('command/Loading')} bind:ref={refs['command/Loading']}>Loading</Command.Loading>
    <Command.Empty {...p('command/Empty')} bind:ref={refs['command/Empty']}>None</Command.Empty>
    {#if variant !== 'empty'}
      <Command.Group value="Go" {...p('command/Group')} bind:ref={refs['command/Group']}>
        <Command.GroupHeading {...p('command/GroupHeading')} bind:ref={refs['command/GroupHeading']}>Go</Command.GroupHeading>
        <Command.GroupItems>
          <Command.Item value="Inbox">Inbox</Command.Item>
          <Command.Item value="Settings" {...p('command/Item')} bind:ref={refs['command/Item']}>Settings</Command.Item>
        </Command.GroupItems>
      </Command.Group>
    {/if}
  </Command.List>
</Command.Root>
