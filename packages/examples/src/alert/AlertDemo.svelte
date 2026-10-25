<script lang="ts">
import { ALERT_TONES, Alert, type AlertTone, Banner, Callout } from 'texuli/alert';
import { scopedTheme } from '../scoped-theme.ts';

let dismissed = $state(false);

const toneTitle: Record<AlertTone, string> = {
  info: 'Information',
  success: 'Success',
  warning: 'Warning',
  error: 'Error',
  brand: 'Brand',
  neutral: 'Neutral',
};
</script>

<div class="demo" data-example="texuli-alert">
  <section>
    <h2>Default alert</h2>
    <Alert title="Saved" text="Your draft is stored in this browser only." />
  </section>

  <section>
    <h2>Every tone</h2>
    <div class="stack">
      {#each ALERT_TONES as tone (tone)}
        <Alert {tone} title={toneTitle[tone]} text={`Tone “${tone}” on the token contract.`} />
      {/each}
    </div>
  </section>

  <section>
    <h2>Error role + action</h2>
    <Alert
      tone="error"
      title="Publish failed"
      text="The export could not be written. Try again."
      actionLabel="Retry"
      onAction={() => undefined}
    />
  </section>

  <section>
    <h2>Dismissible</h2>
    {#if !dismissed}
      <Alert
        tone="info"
        title="New theme"
        text="A quieter palette is available in Theme Studio."
        dismissible
        dismissLabel="Dismiss announcement"
        onDismiss={() => (dismissed = true)}
      />
    {:else}
      <p class="muted">Announcement dismissed.</p>
    {/if}
  </section>

  <section>
    <h2>Callout</h2>
    <Callout tone="brand" title="Design tip" text="Prefer logical properties for padding and borders." />
  </section>

  <section>
    <h2>Banner</h2>
    <Banner
      tone="warning"
      title="Scheduled maintenance"
      text="Read-only window begins Friday 02:00 UTC."
      actionLabel="Status page"
      actionHref="https://example.com/status"
      dismissible
      dismissLabel="Dismiss banner"
    />
  </section>

  <section dir="rtl" lang="ar">
    <h2>RTL</h2>
    <Alert tone="success" title="تم الحفظ" text="المسودة محفوظة محلياً." actionLabel="عرض" />
  </section>

  <section use:scopedTheme={'dark'} class="dark-panel">
    <h2>Dark</h2>
    <Alert tone="info" title="Dark mode" text="Token fills stay readable on the dark canvas." />
    <Callout tone="warning" title="Contrast" text="Forced-colors borders still outline the surface." />
  </section>
</div>

<style>
  .demo {
    display: grid;
    gap: 1.5rem;
    padding: 1rem;
    max-inline-size: 40rem;
    font-family: var(--tx-font-sans, system-ui, sans-serif);
    color: var(--tx-foreground, CanvasText);
    background: var(--tx-background, Canvas);
  }
  section {
    display: grid;
    gap: 0.5rem;
  }
  h2 {
    margin: 0;
    font-size: 0.85rem;
    font-weight: 600;
  }
  .stack {
    display: grid;
    gap: 0.5rem;
  }
  .muted {
    margin: 0;
    color: var(--tx-muted-foreground, GrayText);
    font-size: 0.875rem;
  }
  /* A real dark theme scope (scopedTheme): every token switches together. */
  .dark-panel {
    display: grid;
    gap: 0.5rem;
    padding: 0.75rem;
    border-radius: var(--tx-radius, 0.5rem);
    background: var(--tx-background, Canvas);
    color: var(--tx-foreground, CanvasText);
  }
</style>
