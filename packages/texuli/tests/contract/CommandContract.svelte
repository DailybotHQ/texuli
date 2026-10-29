<script lang="ts">
import type { HarnessProps } from '../../../primitives/tests/support/contract.ts';
import { Command, CommandPalette } from '../../src/components/command/index.ts';

let { p, refs, variant = 'list' }: HarnessProps = $props();
const k = (name: string) => `components/command/${name}`;
let input = $state<HTMLElement | null>(null);
const onSearch = $derived(variant === 'loading' ? () => new Promise<void>(() => {}) : undefined);
$effect(() => {
  if (variant !== 'loading' || !(input instanceof HTMLInputElement)) return;
  input.value = 'in';
  input.dispatchEvent(new Event('input', { bubbles: true }));
});
</script>

{#if variant === 'palette'}
  <Command.Trigger label="Search…" {...p(k('CommandTrigger'))} bind:ref={refs[k('CommandTrigger')]} />
  <CommandPalette open {...p(k('CommandPalette'))} bind:ref={refs[k('CommandPalette')]} />
{:else}
  <Command.Root label="Commands" {onSearch} {...p(k('CommandRoot'))} bind:ref={refs[k('CommandRoot')]}>
    {#if variant === 'loading'}
      <Command.Input bind:ref={input} />
    {:else}
      <Command.Input {...p(k('CommandInput'))} bind:ref={refs[k('CommandInput')]} />
    {/if}
    <Command.List {...p(k('CommandList'))} bind:ref={refs[k('CommandList')]}>
      <Command.Loading {...p(k('CommandLoading'))} bind:ref={refs[k('CommandLoading')]}>Loading</Command.Loading>
      <Command.Empty {...p(k('CommandEmpty'))} bind:ref={refs[k('CommandEmpty')]}>None</Command.Empty>
      {#if variant !== 'empty'}
        <Command.Group value="Go" {...p(k('CommandGroup'))} bind:ref={refs[k('CommandGroup')]}>
          <Command.GroupHeading {...p(k('CommandGroupHeading'))} bind:ref={refs[k('CommandGroupHeading')]}>Go</Command.GroupHeading>
          <Command.GroupItems>
            <Command.Item value="inbox">Inbox</Command.Item>
            <Command.Item value="settings" {...p(k('CommandItem'))} bind:ref={refs[k('CommandItem')]}>Settings</Command.Item>
          </Command.GroupItems>
        </Command.Group>
      {/if}
    </Command.List>
  </Command.Root>
{/if}
