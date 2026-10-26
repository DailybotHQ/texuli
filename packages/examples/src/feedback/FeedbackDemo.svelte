<script lang="ts">
import { Button } from 'texuli/button';
import { Progress, Skeleton, Spinner } from 'texuli/feedback';

let upload = $state(42);
let loaded = $state(false);
</script>

<!-- data-tx-motion=reduce keeps spinner/indeterminate chrome stable for visual baselines -->
<section data-example="texuli-feedback" data-tx-motion="reduce" aria-labelledby="feedback-demo-title">
  <h2 id="feedback-demo-title">Skeleton, Spinner and Progress</h2>

  <h3>Skeleton</h3>
  <div class="row" dir="rtl">
    <Skeleton size="sm" class="w-full" />
    <Skeleton size="md" class="w-3-4" />
    <Skeleton size="lg" class="w-1-2" />
    <Skeleton circle size="md" />
  </div>

  <h3>Loading to content</h3>
  {#if loaded}
    <div class="content-swap" aria-label="Loaded project summary">
      <strong>Harbor Notes release summary</strong>
      <span>Three fictional updates are ready for review.</span>
    </div>
  {:else}
    <div class="content-swap" aria-label="Loading project summary">
      <Skeleton size="sm" class="w-3-4" />
      <Skeleton size="sm" class="w-full" />
    </div>
  {/if}
  <Button variant="outline" size="sm" onclick={() => (loaded = !loaded)}>
    {loaded ? 'Show loading state' : 'Load summary'}
  </Button>

  <h3>Spinner</h3>
  <div class="row">
    <Spinner size="sm" tone="neutral" />
    <Spinner label="Saving Harbor Notes" tone="primary" size="md" />
    <Spinner label="Syncing" tone="success" size="lg" />
  </div>

  <h3>Progress (linear)</h3>
  <div class="stack">
    <Progress label="Upload" value={upload} showValue tone="primary" size="md" />
    <Progress label="Working" value={null} tone="info" size="sm" />
    <Progress label="Complete" value={100} showValue tone="success" size="lg" />
  </div>
  <p>
    <Button variant="outline" size="sm" onclick={() => (upload = Math.min(100, upload + 15))}>
      Advance upload
    </Button>
  </p>

  <h3>Progress (circular)</h3>
  <div class="row">
    <Progress shape="circular" value={28} showValue ariaLabel="CPU" tone="warning" size="sm" />
    <Progress shape="circular" value={72} showValue label="Disk" tone="info" size="md" />
    <Progress shape="circular" value={null} showValue ariaLabel="Connecting" tone="primary" size="lg" />
  </div>
</section>

<style>
  .row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 1rem;
    max-inline-size: 36rem;
  }
  .stack {
    display: grid;
    gap: 1rem;
    max-inline-size: 28rem;
  }
  :global(.w-full) {
    inline-size: 100%;
    max-inline-size: 16rem;
  }
  .content-swap {
    display: grid;
    gap: 0.25rem;
    inline-size: min(100%, 28rem);
    min-block-size: 3.5rem;
    padding: 0.75rem;
    border: 1px solid var(--tx-border, ButtonBorder);
    border-radius: var(--tx-radius, 0.5rem);
    background: var(--tx-surface, Canvas);
  }
  .content-swap span {
    color: var(--tx-muted-foreground, GrayText);
  }
  :global(.w-3-4) {
    inline-size: 75%;
    max-inline-size: 12rem;
  }
  :global(.w-1-2) {
    inline-size: 50%;
    max-inline-size: 8rem;
  }
</style>
