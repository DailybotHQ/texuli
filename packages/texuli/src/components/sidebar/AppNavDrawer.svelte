<script lang="ts">
import type { FocusRestoreEvent } from '@texuli/core/focus-scope';
import { Sheet } from '@texuli/primitives/sheet';
import type { Snippet } from 'svelte';
import { VisuallyHidden } from '../separator-aspect/index.ts';
import Sidebar from './Sidebar.svelte';
import type { SidebarItem, SidebarSection } from './types.ts';
import type { SidebarVariant } from './variants.ts';

type Props = {
  open?: boolean;
  items?: readonly SidebarItem[];
  sections?: readonly SidebarSection[];
  variant: SidebarVariant;
  header?: Snippet<[{ collapsed: boolean }]>;
  footer?: Snippet<[{ collapsed: boolean }]>;
  itemIcon?: Snippet<[item: SidebarItem, collapsed: boolean]>;
  label: string;
  drawerTitle: string;
  closeLabel: string;
  hrefTrust: 'developer' | 'untrusted';
  opener: () => HTMLButtonElement | undefined;
};

let {
  open = $bindable(false),
  items,
  sections,
  variant,
  header,
  footer,
  itemIcon,
  label,
  drawerTitle,
  closeLabel,
  hrefTrust,
  opener,
}: Props = $props();

function restoreOpener(event: FocusRestoreEvent): void {
  if (event.defaultPrevented) return;
  event.preventDefault();
  opener()?.focus({ preventScroll: true });
}
</script>

<Sheet.Root bind:open onCloseAutoFocus={restoreOpener}>
  <Sheet.Portal>
    <Sheet.Overlay />
    <Sheet.Content side="start" class="tx-app-nav-sheet" data-tx-app-nav-sheet>
      <Sheet.Title>
        <VisuallyHidden>{drawerTitle}</VisuallyHidden>
      </Sheet.Title>
      <Sheet.Close class="tx-app-nav-sheet__close" aria-label={closeLabel} data-tx-app-nav-close>
        ×
      </Sheet.Close>
      <div class="tx-app-nav__drawer-sidebar">
        <Sidebar
          {items}
          {sections}
          drawer
          collapsible={false}
          {variant}
          {header}
          {footer}
          {itemIcon}
          {label}
          {hrefTrust}
        />
      </div>
    </Sheet.Content>
  </Sheet.Portal>
</Sheet.Root>
