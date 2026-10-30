<script lang="ts">
/**
 * /motion-page/ component motion: every styled component that animates
 * through `texuli/motion`, live, under one MotionProvider that follows the
 * page settings. Floating parts (tooltip, popover, hover card, the four
 * menus) scale in and fade out; the alert dialog scales over a fading
 * backdrop; the drawer, detail panel and responsive modal slide from their
 * edge; the accordion animates its height and the tabs indicator glides.
 * (Dialog, Sheet and the Toaster are in the presence demo above.) The list
 * of adopters under this demo is checked against the package sources.
 */
import { Button } from 'texuli/button';
import { AlertDialog } from 'texuli/dialog';
import { ContextMenu, DropdownMenu, Menubar } from 'texuli/menus';
import { MotionProvider } from 'texuli/motion';
import { HoverCard, Popover } from 'texuli/popover';
import { DetailPanel, Drawer, ResponsiveModal } from 'texuli/sheet';
import { Accordion, Tabs } from 'texuli/tabs-accordion';
import { Tooltip } from 'texuli/tooltip';
import SettingsNote from './SettingsNote.svelte';
import { MOTION_SETTINGS, providerReduced } from './settings.svelte.ts';

let alertOpen = $state(false);
let outcome = $state<string | undefined>(undefined);
let faq = $state('');
let tab = $state('notes');
let menubarValue = $state('');
let grid = $state(true);
</script>

<MotionProvider level={MOTION_SETTINGS.level} reducedMotion={providerReduced()}>
  <div class="gallery" data-motion-components="">
    <ul class="gallery__grid">
      <li class="gallery__card" data-motion-component="tooltip">
        <h3>Tooltip</h3>
        <p class="gallery__meta"><code>scale</code> in, <code>fade</code> out, <code>fast</code></p>
        <Tooltip content="Saves without publishing" delayDuration={150}>
          {#snippet children({ props })}
            <Button {...props} variant="outline">Hover or focus me</Button>
          {/snippet}
        </Tooltip>
      </li>

      <li class="gallery__card" data-motion-component="popover">
        <h3>Popover</h3>
        <p class="gallery__meta"><code>scale</code> in and out, <code>fast</code></p>
        <Popover.Root side="bottom" align="start">
          <Popover.Trigger class="gallery__trigger">Open popover</Popover.Trigger>
          <Popover.Content aria-label="Release owner">
            <p class="gallery__pop">Ada Example owns the release notes.</p>
            <Popover.Close class="gallery__trigger">Close</Popover.Close>
          </Popover.Content>
        </Popover.Root>
      </li>

      <li class="gallery__card" data-motion-component="hover-card">
        <h3>Hover card</h3>
        <p class="gallery__meta"><code>scale</code> in, <code>fade</code> out, <code>fast</code></p>
        <HoverCard.Root openDelay={150} closeDelay={100}>
          <HoverCard.Trigger class="gallery__trigger">Lin Example</HoverCard.Trigger>
          <HoverCard.Content aria-label="Lin Example">
            <p class="gallery__pop">Platform lead · lin@example.com</p>
          </HoverCard.Content>
        </HoverCard.Root>
      </li>

      <li class="gallery__card" data-motion-component="dropdown-menu">
        <h3>Dropdown menu and submenu</h3>
        <p class="gallery__meta"><code>scale</code> in, <code>fade</code> out, <code>fast</code></p>
        <DropdownMenu.Root>
          <DropdownMenu.Trigger>Actions</DropdownMenu.Trigger>
          <DropdownMenu.Content>
            <DropdownMenu.Item>Rename</DropdownMenu.Item>
            <DropdownMenu.Sub>
              <DropdownMenu.SubTrigger>Share</DropdownMenu.SubTrigger>
              <DropdownMenu.SubContent>
                <DropdownMenu.Item>Copy link</DropdownMenu.Item>
                <DropdownMenu.Item>Email</DropdownMenu.Item>
              </DropdownMenu.SubContent>
            </DropdownMenu.Sub>
            <DropdownMenu.CheckboxItem bind:checked={grid}>Show grid</DropdownMenu.CheckboxItem>
          </DropdownMenu.Content>
        </DropdownMenu.Root>
      </li>

      <li class="gallery__card" data-motion-component="context-menu">
        <h3>Context menu</h3>
        <p class="gallery__meta"><code>scale</code> in, <code>fade</code> out, <code>fast</code></p>
        <ContextMenu.Root>
          <ContextMenu.Trigger>
            <span class="gallery__region">Right-click here, or focus and press Shift+F10</span>
          </ContextMenu.Trigger>
          <ContextMenu.Content>
            <ContextMenu.Item>Copy</ContextMenu.Item>
            <ContextMenu.Item>Paste</ContextMenu.Item>
          </ContextMenu.Content>
        </ContextMenu.Root>
      </li>

      <li class="gallery__card" data-motion-component="menubar">
        <h3>Menubar</h3>
        <p class="gallery__meta"><code>scale</code> in, <code>fade</code> out, <code>fast</code></p>
        <Menubar.Root bind:value={menubarValue} aria-label="Harbor Notes (demo)">
          <Menubar.Menu value="file">
            <Menubar.Trigger>File</Menubar.Trigger>
            <Menubar.Content>
              <Menubar.Item>New</Menubar.Item>
              <Menubar.Item>Export…</Menubar.Item>
            </Menubar.Content>
          </Menubar.Menu>
          <Menubar.Menu value="view">
            <Menubar.Trigger>View</Menubar.Trigger>
            <Menubar.Content>
              <Menubar.CheckboxItem bind:checked={grid}>Grid</Menubar.CheckboxItem>
            </Menubar.Content>
          </Menubar.Menu>
        </Menubar.Root>
      </li>

      <li class="gallery__card" data-motion-component="alert-dialog">
        <h3>Alert dialog</h3>
        <p class="gallery__meta"><code>scale</code> panel over a <code>fade</code> backdrop, <code>base</code></p>
        <AlertDialog
          bind:open={alertOpen}
          title="Archive the launch board?"
          description="The fictional board moves to the archive; you can restore it."
          confirmLabel="Archive"
          cancelLabel="Keep it"
          onConfirm={() => {
            outcome = 'Archived (nothing happened: it is a demo).';
          }}
        >
          {#snippet trigger({ props })}
            <Button {...props} variant="outline">Archive board</Button>
          {/snippet}
        </AlertDialog>
      </li>

      <li class="gallery__card" data-motion-component="drawer">
        <h3>Drawer</h3>
        <p class="gallery__meta">slides from its edge (<code>rise</code>), <code>base</code></p>
        <Drawer.Root>
          <Drawer.Trigger class="gallery__trigger">Open drawer</Drawer.Trigger>
          <Drawer.Portal>
            <Drawer.Overlay />
            <Drawer.Content>
              <Drawer.Handle label="Resize the drawer" />
              <Drawer.Title>Cart</Drawer.Title>
              <Drawer.Description>Three fictional items.</Drawer.Description>
              <Drawer.Close class="gallery__trigger">Close the drawer</Drawer.Close>
            </Drawer.Content>
          </Drawer.Portal>
        </Drawer.Root>
      </li>

      <li class="gallery__card" data-motion-component="detail-panel">
        <h3>Detail panel</h3>
        <p class="gallery__meta">non-modal, slides from the end, <code>base</code></p>
        <DetailPanel.Root>
          <DetailPanel.Trigger class="gallery__trigger">Show details</DetailPanel.Trigger>
          <DetailPanel.Portal>
            <DetailPanel.Content size="sm">
              <DetailPanel.Title>Order orbit-001</DetailPanel.Title>
              <DetailPanel.Description>The page stays usable behind this panel.</DetailPanel.Description>
              <DetailPanel.Close class="gallery__trigger">Close details</DetailPanel.Close>
            </DetailPanel.Content>
          </DetailPanel.Portal>
        </DetailPanel.Root>
      </li>

      <li class="gallery__card" data-motion-component="responsive-modal">
        <h3>Responsive modal</h3>
        <p class="gallery__meta">a dialog on wide screens, a bottom drawer on phones</p>
        <ResponsiveModal.Root>
          <ResponsiveModal.Trigger class="gallery__trigger">Share order</ResponsiveModal.Trigger>
          <ResponsiveModal.Portal>
            <ResponsiveModal.Overlay />
            <ResponsiveModal.Content>
              <ResponsiveModal.Title>Share order</ResponsiveModal.Title>
              <ResponsiveModal.Description>Copy a fictional link to example.com.</ResponsiveModal.Description>
              <ResponsiveModal.Close class="gallery__trigger">Done</ResponsiveModal.Close>
            </ResponsiveModal.Content>
          </ResponsiveModal.Portal>
        </ResponsiveModal.Root>
      </li>

      <li class="gallery__card gallery__card--wide" data-motion-component="accordion">
        <h3>Accordion</h3>
        <p class="gallery__meta">height animates (layout), <code>base</code></p>
        <Accordion
          bind:value={faq}
          type="single"
          variant="bordered"
          items={[
            { value: 'ship', title: 'When does the beta open?', content: 'Next week, for every fictional pilot team.' },
            { value: 'cost', title: 'What does it cost?', content: 'Nothing during the pilot.' },
          ]}
        />
      </li>

      <li class="gallery__card gallery__card--wide" data-motion-component="tabs">
        <h3>Tabs</h3>
        <p class="gallery__meta">the indicator glides (layout), <code>base</code></p>
        <Tabs
          bind:value={tab}
          label="Release sections (demo)"
          variant="line"
          items={[
            { value: 'notes', label: 'Notes' },
            { value: 'owners', label: 'Owners' },
            { value: 'dates', label: 'Dates' },
          ]}
        >
          {#snippet content(item)}
            <p class="gallery__pop">The {item.label.toLowerCase()} of the fictional release.</p>
          {/snippet}
        </Tabs>
      </li>
    </ul>
    <SettingsNote name="components" {outcome} />
  </div>
</MotionProvider>

<style>
  .gallery {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 0.9rem;
    padding: clamp(0.75rem, 2vw, 1.25rem);
    border: 1px solid var(--tx-border, CanvasText);
    border-radius: 1rem;
    background: var(--tx-surface, Canvas);
    color: var(--tx-foreground, CanvasText);
  }
  .gallery__grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(min(100%, 15rem), 1fr));
    gap: 0.75rem;
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .gallery__card {
    display: grid;
    align-content: start;
    justify-items: start;
    gap: 0.5rem;
    min-inline-size: 0;
    padding: 0.85rem;
    border: 1px solid var(--tx-border, CanvasText);
    border-radius: 0.75rem;
    background: var(--tx-background, Canvas);
  }
  .gallery__card--wide {
    grid-column: span 2;
    justify-items: stretch;
  }
  @media (max-width: 40rem) {
    .gallery__card--wide {
      grid-column: auto;
    }
  }
  .gallery__card h3 {
    margin: 0;
    font-size: 1rem;
  }
  .gallery__meta {
    margin: 0;
    font-size: 0.8125rem;
    color: var(--tx-muted-foreground, CanvasText);
  }
  .gallery__pop {
    margin: 0;
    font-size: 0.875rem;
  }
  .gallery__region {
    display: block;
    padding: 0.6rem 0.75rem;
    border: 1px dashed var(--tx-border, CanvasText);
    border-radius: 0.5rem;
    font-size: 0.875rem;
  }
  :global(.gallery__trigger) {
    min-block-size: 2.25rem;
    padding-inline: 0.8rem;
    border: 1px solid var(--tx-border, ButtonBorder);
    border-radius: 0.5rem;
    background: var(--tx-background, ButtonFace);
    color: var(--tx-foreground, ButtonText);
    font: inherit;
    cursor: pointer;
  }
  :global(.gallery__trigger:focus-visible) {
    outline: 2px solid var(--tx-ring, Highlight);
    outline-offset: 2px;
  }
</style>
