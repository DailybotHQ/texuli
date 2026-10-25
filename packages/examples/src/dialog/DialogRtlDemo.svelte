<script lang="ts">
import { Button } from 'texuli/button';
import { Dialog } from 'texuli/dialog';

let open = $state(true);
</script>

<section data-example="ui-dialog-rtl" class="demo" dir="rtl" lang="ar" aria-label="Dialog RTL">
  <h2>الحوار</h2>
  <p>حوار بإعدادات مساحة عمل هاربور لابز، اتجاه من اليمين إلى اليسار.</p>
  <Dialog
    bind:open
    title="إعدادات مساحة العمل"
    description="حدّث اسم مساحة عمل هاربور لابز والمنطقة الزمنية."
    closeLabel="إغلاق"
  >
    {#snippet trigger({ props })}
      <Button {...props}>فتح الإعدادات</Button>
    {/snippet}
    <p>الاسم والمنطقة واللغة الافتراضية لكل أعضاء الفريق.</p>
    {#snippet footer()}
      <Button variant="outline" onclick={() => (open = false)}>إلغاء</Button>
      <Button onclick={() => (open = false)}>حفظ</Button>
    {/snippet}
  </Dialog>
</section>

<style>
  .demo {
    display: grid;
    gap: 0.75rem;
    padding: 1.5rem;
    min-block-size: 18rem;
    color: var(--tx-foreground, CanvasText);
    background: var(--tx-background, Canvas);
  }
  h2 {
    margin: 0;
    font-size: 1.125rem;
  }
  p {
    margin: 0;
    color: var(--tx-muted-foreground, GrayText);
  }
</style>
