<script lang="ts">
/**
 * Lazy chunk for an event's "Move" menu, so `@texuli/data/calendar/view`
 * stays light. A context menu anchored to the event chip: an invisible
 * region is laid over the chip and opened the way the Menu key would open
 * it, so the menu sits under the chip, focuses its first item and returns
 * focus to the chip when it closes.
 */
import { tick } from 'svelte';
import { ContextMenu } from 'texuli/menus';
import type { MoveChoice } from '../engines/calendar/index.ts';

export interface MoveMenuRequest {
  /** The event chip the menu is for. */
  chip: HTMLElement;
  /** The menu's name ("Move Design review to…"). */
  label: string;
  choices: readonly { choice: MoveChoice; label: string }[];
  /** Changes on every request, so the same chip can open it again. */
  nonce: number;
}

let {
  request,
  onSelect,
}: {
  request: MoveMenuRequest | null;
  onSelect: (choice: MoveChoice) => void;
} = $props();

let open = $state(false);
let region = $state<HTMLElement | null>(null);

$effect(() => {
  const next = request;
  if (!next || !region) return;
  void show(next, region);
});

async function show(next: MoveMenuRequest, anchor: HTMLElement): Promise<void> {
  const box = next.chip.getBoundingClientRect();
  // CSSOM (not a style attribute): lay the region over the chip.
  anchor.style.setProperty('inset-inline-start', 'auto');
  anchor.style.setProperty('left', `${box.left}px`);
  anchor.style.setProperty('top', `${box.top}px`);
  anchor.style.setProperty('width', `${box.width}px`);
  anchor.style.setProperty('height', `${box.height}px`);
  if (next.chip.ownerDocument.activeElement !== next.chip) next.chip.focus({ preventScroll: true });
  await tick();
  // Not a pointer press, so the menu opens under the region on its first item.
  anchor.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }));
}
</script>

<div class="tx-calendar__move-menu" data-calendar-move-menu-ready>
  <ContextMenu.Root bind:open>
    <ContextMenu.Trigger class="tx-calendar__move-anchor">
      <span class="tx-calendar__move-anchor-label" bind:this={region}>{open ? (request?.label ?? '') : ''}</span>
    </ContextMenu.Trigger>
    <ContextMenu.Portal>
      <ContextMenu.Content aria-label={request?.label} data-calendar-move-menu>
        {#each request?.choices ?? [] as { choice, label } (choice.id)}
          <ContextMenu.Item
            disabled={choice.target === null}
            data-calendar-move-choice={choice.id}
            onSelect={() => onSelect(choice)}
          >{label}</ContextMenu.Item>
        {/each}
      </ContextMenu.Content>
    </ContextMenu.Portal>
  </ContextMenu.Root>
</div>

<style>
  .tx-calendar__move-menu :global(.tx-calendar__move-anchor) { position: fixed; inset: 0 auto auto 0; inline-size: 0; block-size: 0; pointer-events: none; }
  .tx-calendar__move-anchor-label { position: fixed; overflow: hidden; clip-path: inset(50%); white-space: nowrap; pointer-events: none; }
</style>
