<script lang="ts">
import { Button } from 'texuli/button';
import { Dialog } from 'texuli/dialog';
import { DropdownMenu } from 'texuli/menus';
import { Popover } from 'texuli/popover';
import { Sheet } from 'texuli/sheet';
import { Toggle, ToggleGroup, ToggleGroupItem } from 'texuli/toggle';

/*
 * The cases of tests/e2e/overlays-0142.spec.ts (fictional data only).
 * dialog-open: a Dialog rendered open at first render (a deep link).
 * sheet-open: a Sheet rendered open at first render.
 * popover-handoff: two Popovers and a menu; focus moves into the second
 *   overlay while the first one plays its exit.
 * toggle-controlled: a Toggle and a ToggleGroup given a value and a change
 *   handler that ignores the change (no bind:).
 */

let { which }: { which: string } = $props();

let dialogOpen = $state(true);
let sheetOpen = $state(true);

let menuOpen = $state(false);
let firstOpen = $state(false);
let secondOpen = $state(false);
let thirdOpen = $state(false);
/** Close the first popover and open another overlay in the same handler. */
function handOff(to: 'menu' | 'second' | 'third'): void {
  firstOpen = false;
  if (to === 'menu') menuOpen = true;
  else if (to === 'second') secondOpen = true;
  else thirdOpen = true;
}

let toggleCalls = $state<boolean[]>([]);
let groupCalls = $state<string[]>([]);
</script>

{#if which === 'dialog-open'}
  <section class="case" aria-label="Dialog mounted open">
    <Dialog bind:open={dialogOpen} title="Deep-linked settings" description="Opened from the URL.">
      {#snippet trigger({ props })}
        <Button {...props}>Open settings</Button>
      {/snippet}
      <p>Harbor Labs workspace settings.</p>
    </Dialog>
  </section>
{:else if which === 'sheet-open'}
  <section class="case" aria-label="Sheet mounted open">
    <Sheet.Root bind:open={sheetOpen}>
      <Sheet.Trigger>Open filters</Sheet.Trigger>
      <Sheet.Portal>
        <Sheet.Overlay />
        <Sheet.Content side="bottom">
          <Sheet.Title>Deep-linked filters</Sheet.Title>
          <Sheet.Description>Opened from the URL.</Sheet.Description>
          <Sheet.Close>Done</Sheet.Close>
        </Sheet.Content>
      </Sheet.Portal>
    </Sheet.Root>
  </section>
{:else if which === 'popover-handoff'}
  <!-- The first popover hands off to an overlay declared before it and to one declared after it. -->
  <section class="case row" aria-label="Popover focus handoff">
    <DropdownMenu.Root bind:open={menuOpen}>
      <DropdownMenu.Trigger>Row actions</DropdownMenu.Trigger>
      <DropdownMenu.Content>
        <DropdownMenu.Item>Rename</DropdownMenu.Item>
        <DropdownMenu.Item>Archive</DropdownMenu.Item>
      </DropdownMenu.Content>
    </DropdownMenu.Root>
    <Popover.Root bind:open={secondOpen}>
      <Popover.Trigger>Second popover</Popover.Trigger>
      <Popover.Content aria-label="Second panel">
        <button type="button">Second action</button>
      </Popover.Content>
    </Popover.Root>
    <Popover.Root bind:open={firstOpen}>
      <Popover.Trigger>First popover</Popover.Trigger>
      <Popover.Content aria-label="First panel">
        <button type="button" onclick={() => handOff('menu')}>Open row actions</button>
        <button type="button" onclick={() => handOff('second')}>Open second</button>
        <button type="button" onclick={() => handOff('third')}>Open third</button>
      </Popover.Content>
    </Popover.Root>
    <Popover.Root bind:open={thirdOpen}>
      <Popover.Trigger>Third popover</Popover.Trigger>
      <Popover.Content aria-label="Third panel">
        <button type="button">Third action</button>
      </Popover.Content>
    </Popover.Root>
  </section>
{:else if which === 'toggle-controlled'}
  <section class="case row" aria-label="Controlled toggles">
    <Toggle pressed={false} onPressedChange={(next) => toggleCalls.push(next)} aria-label="Bold">
      Bold
    </Toggle>
    <ToggleGroup
      type="single"
      value="left"
      onValueChange={(next) => groupCalls.push(String(next))}
      aria-label="Align"
    >
      <ToggleGroupItem value="left" aria-label="Left">Left</ToggleGroupItem>
      <ToggleGroupItem value="right" aria-label="Right">Right</ToggleGroupItem>
    </ToggleGroup>
    <output id="toggle-calls">{toggleCalls.join(',')}</output>
    <output id="group-calls">{groupCalls.join(',')}</output>
  </section>
{/if}

<style>
  .case {
    padding: 2rem;
    min-block-size: 20rem;
  }
  .row {
    display: flex;
    flex-wrap: wrap;
    gap: 1rem;
    align-items: start;
  }
</style>
