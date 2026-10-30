<script lang="ts">
import { applyTheme, type Theme } from '@texuli/tokens';
import { Button } from 'texuli/button';
import { Dialog } from 'texuli/dialog';
import { DropdownMenu } from 'texuli/menus';
import { Select } from 'texuli/select';
import { createToastStore, Toaster } from 'texuli/toast';
import { Tooltip } from 'texuli/tooltip';

/** One themed subtree with every overlay kind (fictional data only). */
export type ScopeApi = {
  set: (kind: 'dialog' | 'menu' | 'select' | 'tooltip', open: boolean) => void;
  toast: (title: string) => void;
  toggleMode: () => void;
};

interface Props {
  id: string;
  label: string;
  theme: Theme;
  mode: 'light' | 'dark';
  register: (id: string, api: ScopeApi) => void;
}
let { id, label, theme, mode: initialMode, register }: Props = $props();

let scopeEl = $state<HTMLElement | null>(null);
// svelte-ignore state_referenced_locally
let mode = $state(initialMode);
let dialogOpen = $state(false);
let menuOpen = $state(false);
let selectOpen = $state(false);
let tooltipOpen = $state(false);
let room = $state<string | undefined>(undefined);
const store = createToastStore({ duration: 0 });
const rooms = [
  { value: 'harbor', label: 'Harbor room' },
  { value: 'lighthouse', label: 'Lighthouse room' },
];

$effect(() => {
  if (scopeEl) applyTheme(scopeEl, { theme, mode });
});

// svelte-ignore state_referenced_locally
register(id, {
  set(kind, open) {
    if (kind === 'dialog') dialogOpen = open;
    else if (kind === 'menu') menuOpen = open;
    else if (kind === 'select') selectOpen = open;
    else tooltipOpen = open;
  },
  toast: (title) => store.info(title),
  toggleMode: () => {
    mode = mode === 'dark' ? 'light' : 'dark';
  },
});
</script>

<section
  bind:this={scopeEl}
  class="scope"
  data-scope={id}
  data-scope-mode={mode}
  aria-label={label}
>
  <h2>{label}</h2>
  <p>A themed subtree; its overlays keep this theme.</p>
  <div class="row">
    <Dialog bind:open={dialogOpen} title={`${label} dialog`} description="Fictional settings.">
      {#snippet trigger({ props })}
        <Button {...props}>Open dialog</Button>
      {/snippet}
      <p>Dialog body for {label}.</p>
    </Dialog>

    <DropdownMenu.Root bind:open={menuOpen}>
      <DropdownMenu.Trigger>Actions</DropdownMenu.Trigger>
      <DropdownMenu.Content>
        <DropdownMenu.Item>Rename</DropdownMenu.Item>
        <DropdownMenu.Item>Duplicate</DropdownMenu.Item>
      </DropdownMenu.Content>
    </DropdownMenu.Root>

    <Select.Root bind:value={room} bind:open={selectOpen} items={rooms}>
      <Select.Trigger aria-label={`${label} room`}>
        <Select.Value placeholder="Choose a room" />
      </Select.Trigger>
      <Select.Portal>
        <Select.Content>
          <Select.Viewport>
            {#each rooms as item (item.value)}
              <Select.Item value={item.value} label={item.label}>{item.label}</Select.Item>
            {/each}
          </Select.Viewport>
        </Select.Content>
      </Select.Portal>
    </Select.Root>

    <Tooltip content={`${label} tip`} open={tooltipOpen}>
      {#snippet children({ props })}
        <Button {...props}>Hint</Button>
      {/snippet}
    </Tooltip>
  </div>
  <Toaster {store} label={`${label} notifications`} position="bottom-start" />
</section>

<style>
  .scope {
    display: grid;
    gap: 0.75rem;
    align-content: start;
    min-block-size: 24rem;
    padding: 1rem;
    background-color: var(--tx-background);
    color: var(--tx-foreground);
  }
  .scope h2,
  .scope p {
    margin: 0;
  }
  .row {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    align-items: center;
  }
</style>
