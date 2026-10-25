<!-- Lazily loaded: carry the styles with the component (Astro attaches lazily
     imported component CSS only to some pages). -->
<svelte:options css="injected" />

<script lang="ts">
/**
 * Sheet, Drawer, DetailPanel and ResponsiveModal, opened from a trigger.
 * Side and size come from the panel; a row of triggers opens the other sides.
 */
import { Button } from 'texuli/button';
import { Switch } from 'texuli/choice';
import { DetailPanel, Drawer, ResponsiveModal, Sheet } from 'texuli/sheet';
import { readers, type StageValues } from './values.ts';

type Props = { componentId: string; values: StageValues };

let { componentId, values }: Props = $props();

const { pick } = readers(() => values);

const SIDES = ['top', 'right', 'bottom', 'left', 'start', 'end', 'center'] as const;
const SIZES = ['sm', 'md', 'lg', 'xl'] as const;

const fallbackSide = $derived(
  componentId === 'drawer' || componentId === 'responsive-modal'
    ? 'bottom'
    : componentId === 'detail-panel'
      ? 'end'
      : 'start'
);
const side = $derived(pick('side', SIDES, fallbackSide));
const size = $derived(pick('size', SIZES, 'md'));

let extraSide = $state<(typeof SIDES)[number]>('end');
let unread = $state(true);
</script>

{#snippet body()}
  <p>Three filters apply to the Harbor order list.</p>
  <Switch bind:checked={unread} label="Unread only" />
  <p class="state" role="status">{unread ? 'Showing unread orders' : 'Showing every order'}</p>
{/snippet}

<div class="stage" data-tx-sheet-stage={componentId}>
  {#if componentId === 'sheet'}
    <div class="row">
      <Sheet.Root>
        <Sheet.Trigger>
          {#snippet child({ props })}<Button {...props}>Open filters</Button>{/snippet}
        </Sheet.Trigger>
        <Sheet.Portal>
          <Sheet.Overlay />
          <Sheet.Content {side} {size}>
            <Sheet.Title>Filters</Sheet.Title>
            <Sheet.Description>Sheet from the {side} edge, size {size}.</Sheet.Description>
            {@render body()}
            <Sheet.Close>
              {#snippet child({ props })}<Button {...props} variant="outline">Done</Button>{/snippet}
            </Sheet.Close>
          </Sheet.Content>
        </Sheet.Portal>
      </Sheet.Root>
      {#each ['start', 'end', 'top', 'bottom'] as const as other (other)}
        <Button variant="ghost" size="sm" onclick={() => (extraSide = other)} aria-pressed={extraSide === other}>
          {other}
        </Button>
      {/each}
    </div>
    <Sheet.Root>
      <Sheet.Trigger>
        {#snippet child({ props })}<Button {...props} variant="outline">Open the {extraSide} sheet</Button>{/snippet}
      </Sheet.Trigger>
      <Sheet.Portal>
        <Sheet.Overlay />
        <Sheet.Content side={extraSide} size="sm">
          <Sheet.Title>{extraSide} sheet</Sheet.Title>
          <Sheet.Description>Logical sides follow the text direction.</Sheet.Description>
          <Sheet.Close>
            {#snippet child({ props })}<Button {...props} variant="outline">Close</Button>{/snippet}
          </Sheet.Close>
        </Sheet.Content>
      </Sheet.Portal>
    </Sheet.Root>
  {:else if componentId === 'drawer'}
    <Drawer.Root>
      <Drawer.Trigger>
        {#snippet child({ props })}<Button {...props}>Open cart</Button>{/snippet}
      </Drawer.Trigger>
      <Drawer.Portal>
        <Drawer.Overlay />
        <Drawer.Content {side} {size} snapPoints={[0.5, 1]}>
          <Drawer.Handle label="Resize cart" />
          <Drawer.Title>Cart</Drawer.Title>
          <Drawer.Description>Three items in the fictional cart.</Drawer.Description>
          {@render body()}
          <Drawer.Close>
            {#snippet child({ props })}<Button {...props} variant="outline">Close cart</Button>{/snippet}
          </Drawer.Close>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  {:else if componentId === 'detail-panel'}
    <DetailPanel.Root>
      <DetailPanel.Trigger>
        {#snippet child({ props })}<Button {...props}>Show order details</Button>{/snippet}
      </DetailPanel.Trigger>
      <DetailPanel.Portal>
        <DetailPanel.Content {side} {size}>
          <DetailPanel.Title>Order HN-1042</DetailPanel.Title>
          <DetailPanel.Description>The page stays usable behind this panel.</DetailPanel.Description>
          {@render body()}
          <DetailPanel.Close>
            {#snippet child({ props })}<Button {...props} variant="outline">Close details</Button>{/snippet}
          </DetailPanel.Close>
        </DetailPanel.Content>
      </DetailPanel.Portal>
    </DetailPanel.Root>
  {:else}
    <ResponsiveModal.Root>
      <ResponsiveModal.Trigger>
        {#snippet child({ props })}<Button {...props}>Share order</Button>{/snippet}
      </ResponsiveModal.Trigger>
      <ResponsiveModal.Portal>
        <ResponsiveModal.Overlay />
        <ResponsiveModal.Content {size}>
          <ResponsiveModal.Handle label="Resize share panel" />
          <ResponsiveModal.Title>Share order</ResponsiveModal.Title>
          <ResponsiveModal.Description>
            Centered on wide screens, a bottom drawer on phones.
          </ResponsiveModal.Description>
          {@render body()}
          <ResponsiveModal.Close>
            {#snippet child({ props })}<Button {...props} variant="outline">Done</Button>{/snippet}
          </ResponsiveModal.Close>
        </ResponsiveModal.Content>
      </ResponsiveModal.Portal>
    </ResponsiveModal.Root>
  {/if}
</div>

<style>
  .stage {
    display: grid;
    gap: 0.6rem;
    justify-items: start;
  }
  .row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.4rem;
  }
  .state {
    margin: 0;
    font-size: 0.875rem;
  }
</style>
