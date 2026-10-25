<script lang="ts">
import { Popover } from 'texuli/popover';
</script>

<section data-example="ui-popover-rtl" class="demo" dir="rtl" lang="ar" aria-label="Popover RTL">
  <h2>قائمة الحساب</h2>
  <p>لوحة منبثقة باتجاه اليمين إلى اليسار مع سهم منطقي.</p>
  <Popover.Root open side="bottom" align="start">
    <Popover.Trigger class="demo-trigger">الحساب</Popover.Trigger>
    <Popover.Content aria-label="قائمة الحساب">
      <div class="tx-popover__header">
        <p class="tx-popover__title">آدا لوفلايس</p>
        <p class="tx-popover__description">ada@example.com</p>
      </div>
      <div class="tx-popover__footer">
        <Popover.Close>إغلاق</Popover.Close>
      </div>
    </Popover.Content>
  </Popover.Root>
</section>

<style>
  .demo {
    display: grid;
    gap: 0.75rem;
    padding: 1.5rem;
    min-block-size: 14rem;
    color: var(--tx-foreground, CanvasText);
    background: var(--tx-background, Canvas);
  }
  h2 {
    margin: 0;
  }
  p {
    margin: 0;
    color: var(--tx-muted-foreground, GrayText);
  }
  .demo :global(.demo-trigger) {
    justify-self: start;
    border: 1px solid var(--tx-border, ButtonBorder);
    border-radius: 0.375rem;
    padding-block: 0.4rem;
    padding-inline: 0.75rem;
    background: var(--tx-surface, Canvas);
    color: inherit;
  }
</style>
