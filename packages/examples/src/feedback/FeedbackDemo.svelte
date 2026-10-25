<script lang="ts">
import { Progress, Skeleton, Spinner } from 'texuli/feedback';

let upload = $state(42);
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
    <button type="button" onclick={() => (upload = Math.min(100, upload + 15))}>Advance upload</button>
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
  :global(.w-3-4) {
    inline-size: 75%;
    max-inline-size: 12rem;
  }
  :global(.w-1-2) {
    inline-size: 50%;
    max-inline-size: 8rem;
  }
</style>
