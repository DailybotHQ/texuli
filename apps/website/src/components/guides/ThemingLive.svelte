<script lang="ts">
import { Badge } from 'texuli/badge';
import { Button } from 'texuli/button';

const swatches = [
  { name: 'background', varName: '--tx-background' },
  { name: 'foreground', varName: '--tx-foreground' },
  { name: 'primary', varName: '--tx-primary' },
  { name: 'accent', varName: '--tx-accent' },
  { name: 'muted', varName: '--tx-muted' },
  { name: 'border', varName: '--tx-border' },
] as const;
</script>

<div class="guide-live" data-guide-live="theming">
  <p class="guide-live__label">Live · theme tokens on this page</p>
  <ul class="swatches" aria-label="Theme color tokens">
    {#each swatches as swatch (swatch.varName)}
      <li>
        <span class="chip" style:background={`var(${swatch.varName})`} aria-hidden="true"></span>
        <span class="meta">
          <span class="name">{swatch.name}</span>
          <code>{swatch.varName}</code>
        </span>
      </li>
    {/each}
  </ul>
  <div class="row">
    <Badge>Primary badge</Badge>
    <Badge variant="secondary">Secondary</Badge>
    <Button size="sm" variant="outline">Uses primary ring</Button>
  </div>
</div>

<style>
  .swatches {
    margin: 0;
    padding: 0;
    list-style: none;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(9.5rem, 1fr));
    gap: 0.5rem;
  }
  li {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    min-inline-size: 0;
  }
  .chip {
    flex: 0 0 auto;
    inline-size: 1.75rem;
    block-size: 1.75rem;
    border-radius: var(--tx-radius, 0.375rem);
    border: 1px solid var(--tx-border);
  }
  .meta {
    display: grid;
    min-inline-size: 0;
  }
  .name {
    font-size: 0.8125rem;
    font-weight: 600;
  }
  code {
    font-size: 0.7rem;
    overflow-wrap: anywhere;
  }
  .row {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    align-items: center;
  }
  @media (forced-colors: active) {
    .chip {
      border-color: ButtonText;
      forced-color-adjust: none;
    }
  }
</style>
