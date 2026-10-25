<script lang="ts">
import * as Menu from '@texuli/primitives/menu';
import type { ColumnMenuAction } from './model.ts';

/**
 * A column's menu (loaded lazily by `ColumnGrid`): the Menu primitive's menu
 * button pattern, with items grouped by separators. The trigger stays out of
 * the tab order; the grid opens it from its header cell.
 */
interface Props {
  label: string;
  /** Groups of actions, drawn with separators between them. */
  groups: readonly (readonly ColumnMenuAction[])[];
  onAction: (id: string) => void;
  onOpenChange?: (open: boolean) => void;
}

let { label, groups, onAction, onOpenChange }: Props = $props();
let open = $state(false);
</script>

<Menu.Root bind:open {onOpenChange}>
  <Menu.Trigger class="tx-grid-columns__menu-button" aria-label={label} tabindex={-1} data-tx-grid-menu="">
    <svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="3" cy="8" r="1.4" /><circle cx="8" cy="8" r="1.4" /><circle cx="13" cy="8" r="1.4" /></svg>
  </Menu.Trigger>
  <Menu.Content class="tx-grid-columns__menu">
    {#each groups as group, index (index)}
      {#if index > 0}<Menu.Separator class="tx-grid-columns__menu-separator" />{/if}
      {#each group as action (action.id)}
        <Menu.Item
          class="tx-grid-columns__menu-item"
          disabled={action.disabled}
          closeOnSelect={!action.keepOpen}
          onSelect={() => onAction(action.id)}
        >
          {action.label}
        </Menu.Item>
      {/each}
    {/each}
  </Menu.Content>
</Menu.Root>
