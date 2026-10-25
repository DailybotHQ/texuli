<!-- Lazily loaded: carry the styles with the component (Astro attaches lazily
     imported component CSS only to some pages). -->
<svelte:options css="injected" />

<script lang="ts">
/**
 * Popover, HoverCard and Tooltip, opened from their triggers by pointer,
 * focus or keyboard. Placement and surface come from the panel.
 */
import { Button } from 'texuli/button';
import { Switch } from 'texuli/choice';
import { HoverCard, Popover } from 'texuli/popover';
import { Tooltip } from 'texuli/tooltip';
import { readers, type StageValues } from './values.ts';

type Props = { componentId: string; values: StageValues };

let { componentId, values }: Props = $props();

const { str, num, bool, pick } = readers(() => values);

const SIDES = ['top', 'right', 'bottom', 'left'] as const;
const ALIGNS = ['start', 'center', 'end'] as const;
const own = (id: string) => componentId === id;

let unread = $state(true);
</script>

<div class="stage" data-tx-popover-stage={componentId}>
  {#if componentId === 'popover' || componentId === 'popover-content'}
    <Popover.Root
      side={own('popover-content') ? pick('side', SIDES, 'bottom') : 'bottom'}
      align={own('popover-content') ? pick('align', ALIGNS, 'center') : 'center'}
    >
      <Popover.Trigger>
        {#snippet child({ props })}<Button {...props} variant="outline">Filters</Button>{/snippet}
      </Popover.Trigger>
      <Popover.Content
        aria-label="Filters"
        variant={own('popover-content') ? pick('variant', ['elevated', 'flat'] as const, 'elevated') : 'elevated'}
        size={own('popover-content') ? pick('size', ['sm', 'md', 'lg'] as const, 'md') : 'md'}
        arrow={own('popover-content') ? bool('arrow', true) : true}
      >
        <p class="tx-popover__title">Filters</p>
        <Switch bind:checked={unread} label="Unread only" />
        <div class="tx-popover__footer">
          <Popover.Close>
            {#snippet child({ props })}<Button {...props} size="sm">Apply</Button>{/snippet}
          </Popover.Close>
        </div>
      </Popover.Content>
    </Popover.Root>
    <p class="state" role="status">{unread ? 'Unread orders only' : 'Every order'}</p>
  {:else if componentId === 'hover-card' || componentId === 'hover-card-content'}
    <p class="state">
      Assigned to
      <HoverCard.Root openDelay={200} closeDelay={150}>
        <HoverCard.Trigger>Ada Park</HoverCard.Trigger>
        <HoverCard.Content
          aria-label="Ada Park"
          variant={own('hover-card-content') ? pick('variant', ['elevated', 'flat'] as const, 'elevated') : 'elevated'}
          size={own('hover-card-content') ? pick('size', ['sm', 'md', 'lg'] as const, 'md') : 'md'}
          arrow={own('hover-card-content') ? bool('arrow', true) : true}
        >
          <p class="tx-hover-card__title">Ada Park</p>
          <p class="tx-hover-card__description">Design lead · Harbor Notes · 24 notes this week</p>
        </HoverCard.Content>
      </HoverCard.Root>
      — hover or focus the name.
    </p>
  {:else}
    <div class="row">
      <Tooltip
        content={str('content', 'Save note')}
        shortcut={str('shortcut') || undefined}
        side={pick('side', SIDES, 'top')}
        align={pick('align', ALIGNS, 'center')}
        sideOffset={num('sideOffset', 6)}
        delayDuration={num('delayDuration', 300)}
        disabled={bool('disabled')}
      >
        {#snippet children({ props })}
          <Button {...props}>Save</Button>
        {/snippet}
      </Tooltip>
      {#each SIDES as side (side)}
        <Tooltip content={`Tip on the ${side}`} {side} delayDuration={0}>
          {#snippet children({ props })}
            <Button {...props} variant="outline" size="sm">{side}</Button>
          {/snippet}
        </Tooltip>
      {/each}
    </div>
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
    gap: 0.5rem;
  }
  .state {
    margin: 0;
    font-size: 0.875rem;
  }
</style>
