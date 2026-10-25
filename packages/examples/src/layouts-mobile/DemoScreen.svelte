<script lang="ts">
import { DEALS } from './nav.ts';

/** The routed screen: plain content per path, with links into a detail screen. */
let { path }: { path: string } = $props();
const deal = $derived(DEALS.find((d) => path === `/deals/${d.id}`));
</script>

<div class="screen">
  {#if deal}
    <p class="lead">{deal.name}</p>
    <dl>
      <dt>Amount</dt>
      <dd>{deal.amount}</dd>
      <dt>Stage</dt>
      <dd>Open</dd>
    </dl>
  {:else if path.startsWith('/deals')}
    <ul class="list">
      {#each DEALS as item (item.id)}
        <li><a href={`#/deals/${item.id}`}>{item.name}</a> <span>{item.amount}</span></li>
      {/each}
    </ul>
  {:else}
    <p class="lead">Good morning, Ada.</p>
    <p>3 deals need a follow-up today. Open <a href="#/deals">Deals</a> to see them.</p>
  {/if}
</div>

<style>
  .screen {
    display: grid;
    gap: 0.75rem;
    padding: 1rem;
  }
  .lead {
    margin: 0;
    font-size: 1.125rem;
    font-weight: 600;
  }
  p,
  dl {
    margin: 0;
  }
  dl {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 0.25rem 1rem;
  }
  dt {
    color: var(--tx-muted-foreground, CanvasText);
  }
  dd {
    margin: 0;
  }
  .list {
    display: grid;
    gap: 0.5rem;
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .list li {
    display: flex;
    justify-content: space-between;
    gap: 1rem;
    padding: 0.75rem;
    border: 1px solid var(--tx-border, currentColor);
    border-radius: var(--tx-radius, 0.5rem);
  }
  a {
    color: var(--tx-primary, LinkText);
  }
</style>
