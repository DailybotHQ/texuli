<script lang="ts">
/**
 * Lazy chunk for the board “Move …” menu (DropdownMenu + destinations).
 * Loaded on first open/focus/pointerenter so `@texuli/data/board` stays light.
 */
import { DropdownMenu } from 'texuli/menus';
import type { MoveMenuDestination } from './model.ts';

interface Props {
  open?: boolean;
  disabled?: boolean;
  /** Accessible name on the trigger. */
  label: string;
  /** Accessible name on the menu content. */
  menuLabel: string;
  destinations: readonly MoveMenuDestination[];
  onSelect: (destination: MoveMenuDestination) => void;
  onOpenChange?: (open: boolean) => void;
}

let {
  open = $bindable(false),
  disabled = false,
  label,
  menuLabel,
  destinations,
  onSelect,
  onOpenChange,
}: Props = $props();

function handleOpenChange(next: boolean): void {
  open = next;
  onOpenChange?.(next);
}
</script>

<div class="tx-board__move-menu-host" data-board-move-menu-ready="" data-ready="">
  <DropdownMenu.Root bind:open onOpenChange={handleOpenChange}>
    <DropdownMenu.Trigger
      class="tx-board__move-menu"
      data-board-move-menu
      aria-label={label}
      aria-haspopup="menu"
      {disabled}
    >
      <span class="tx-board__move-menu-glyph" aria-hidden="true">⋮</span>
    </DropdownMenu.Trigger>
    <DropdownMenu.Portal>
      <DropdownMenu.Content aria-label={menuLabel} data-board-move-menu-content>
        <DropdownMenu.Label>{menuLabel}</DropdownMenu.Label>
        {#each destinations as destination (destination.id)}
          <DropdownMenu.Item
            disabled={destination.disabled}
            data-board-move-destination={destination.id}
            onSelect={() => onSelect(destination)}
          >
            {destination.label}
          </DropdownMenu.Item>
        {/each}
      </DropdownMenu.Content>
    </DropdownMenu.Portal>
  </DropdownMenu.Root>
</div>
