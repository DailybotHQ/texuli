<script lang="ts">
import {
  HoverCardContent as Content,
  HoverCardRoot as Root,
  HoverCardTrigger as Trigger,
} from '../../../../packages/primitives/src/hover-card/index.ts';
import { behaviorEvent } from '../../harness/client/events.ts';

let open = $state(false);
</script>

{#snippet customTrigger({ props })}
  {@const { attach, ...triggerProps } = props}
  <button {@attach attach} {...triggerProps}>Profile preview</button>
{/snippet}

{#snippet customContent({ props })}
  {@const { attach, ...contentProps } = props}
  <div {@attach attach} {...contentProps}>
    <p>Sam Chen, product designer</p>
  </div>
{/snippet}

<Root bind:open openDelay={100} closeDelay={80} onOpenChange={(next) => behaviorEvent('openChange', next)}>
  <Trigger child={customTrigger} />
  <Content child={customContent} class="behavior-card" data-behavior-layer aria-label="Profile preview" />
</Root>

<style>
  :global(.behavior-card) {
    position: fixed;
    z-index: 10;
    padding: 0.75rem;
    border: 1px solid CanvasText;
    background: Canvas;
    color: CanvasText;
  }
</style>
