<script lang="ts">
import { Select } from 'texuli/select';

const items = [
  { value: 'ar', label: 'العربية' },
  { value: 'en', label: 'English' },
  { value: 'fr', label: 'Français' },
];

let value = $state('ar');
let open = $state(true);
</script>

<section data-example="ui-select-rtl" class="demo" dir="rtl" lang="ar" aria-label="Select RTL">
  <h2>اللغة</h2>
  <p>قائمة اختيار باتجاه اليمين إلى اليسار مع تسميات مترجمة.</p>
  <Select.Root bind:value bind:open {items} name="lang">
    <Select.Trigger aria-label="اللغة">
      <Select.Value placeholder="اختر لغة" />
    </Select.Trigger>
    <Select.Portal>
      <Select.Content>
        <Select.Viewport>
          {#each items as item (item.value)}
            <Select.Item value={item.value} label={item.label}>{item.label}</Select.Item>
          {/each}
        </Select.Viewport>
      </Select.Content>
    </Select.Portal>
  </Select.Root>
</section>

<style>
  .demo {
    display: grid;
    gap: 0.75rem;
    justify-items: start;
    padding: 1.5rem;
    min-block-size: 16rem;
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
  .demo :global(.tx-select-root) {
    min-inline-size: 14rem;
  }
</style>
