<script lang="ts">
import { Button } from 'texuli/button';
import { Tooltip } from 'texuli/tooltip';

let openDefault = $state(true);
let openShortcut = $state(true);
let openBottom = $state(true);
let openRtl = $state(true);
let openDark = $state(true);
</script>

<section data-example="texuli-tooltip" aria-labelledby="tx-tooltip-title">
  <h2 id="tx-tooltip-title">Tooltip</h2>
  <p>
    Styled tooltips with optional shortcut chips. Forced open for visual capture;
    hover and focus still work. Fictional Harbor Notes copy.
  </p>

  <h3>Default (top)</h3>
  <div class="row" data-axis="default">
    <Tooltip content="Saves without publishing" bind:open={openDefault} delayDuration={0}>
      {#snippet children({ props })}
        <Button {...props} variant="outline">Save draft</Button>
      {/snippet}
    </Tooltip>
  </div>

  <h3>With shortcut</h3>
  <div class="row" data-axis="shortcut">
    <Tooltip
      content="Save draft"
      shortcut={['⌘', 'S']}
      bind:open={openShortcut}
      delayDuration={0}
    >
      {#snippet children({ props })}
        <Button {...props}>Save</Button>
      {/snippet}
    </Tooltip>
  </div>

  <h3>Sides</h3>
  <div class="row" data-axis="sides">
    <Tooltip content="Bottom placement" side="bottom" bind:open={openBottom} delayDuration={0}>
      {#snippet children({ props })}
        <Button {...props} variant="secondary">Bottom</Button>
      {/snippet}
    </Tooltip>
    <Tooltip content="Disabled tip" disabled>
      {#snippet children({ props })}
        <Button {...props} variant="ghost" disabled>No tip</Button>
      {/snippet}
    </Tooltip>
  </div>

  <h3>RTL</h3>
  <div class="row" dir="rtl" lang="ar" data-axis="rtl">
    <Tooltip content="حفظ المسودة" shortcut={['⌘', 'S']} bind:open={openRtl} delayDuration={0}>
      {#snippet children({ props })}
        <Button {...props} variant="outline">حفظ</Button>
      {/snippet}
    </Tooltip>
  </div>

  <h3>Dark</h3>
  <div class="row dark-panel" data-tx-mode="dark" data-axis="dark">
    <Tooltip content="Dark surface tip" shortcut="Esc" bind:open={openDark} delayDuration={0}>
      {#snippet children({ props })}
        <Button {...props} variant="default">Inspect</Button>
      {/snippet}
    </Tooltip>
  </div>
</section>

<style>
  section {
    display: grid;
    gap: 1.25rem;
    padding: 1rem;
    max-inline-size: 40rem;
  }

  .row {
    display: flex;
    flex-wrap: wrap;
    gap: 1rem;
    align-items: center;
    min-block-size: 4rem;
  }

  .dark-panel {
    padding: 1rem;
    border-radius: var(--tx-radius, 0.5rem);
    background: var(--tx-background, #0a0a0a);
    color: var(--tx-foreground, #fafafa);
  }
</style>
