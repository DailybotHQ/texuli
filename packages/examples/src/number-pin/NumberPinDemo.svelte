<script lang="ts">
import { REGEXP_ONLY_DIGITS } from '@texuli/primitives/pin-input';
import { NumberField, PinInput } from 'texuli/number-pin';

let amount = $state<number | null>(128.5);
let code = $state('12');
let disabledCode = $state('');
const sizes = ['sm', 'md', 'lg'] as const;
</script>

<section class="demo" data-example="texuli-number-pin" aria-label="NumberField and PinInput examples">
  <section>
    <h2>NumberField sizes</h2>
    <div class="row">
      {#each sizes as size (size)}
        <div class="control">
          <label for="amount-{size}-input">{size === 'md' ? 'Quantity' : `Quantity (${size})`}</label>
          <NumberField.Root id="amount-{size}" bind:value={amount} min={0} max={999} step={0.5} {size}>
            <NumberField.Decrement aria-label="Decrease quantity" />
            <NumberField.Input aria-label="Quantity" />
            <NumberField.Increment aria-label="Increase quantity" />
          </NumberField.Root>
        </div>
      {/each}
    </div>
  </section>

  <section>
    <h2>One-time code</h2>
    <div class="control">
      <label for="verification-code">Verification code</label>
      <PinInput.Root bind:value={code} inputId="verification-code" maxlength={6} pattern={REGEXP_ONLY_DIGITS}>
        {#snippet children({ cells })}
          {#each cells as cell, index (index)}<PinInput.Cell {cell} />{/each}
        {/snippet}
      </PinInput.Root>
    </div>
  </section>

  <section class="row">
    <div class="control">
      <h2>Disabled</h2>
      <NumberField.Root id="disabled-quantity" value={4} min={0} max={9} disabled size="sm">
        <NumberField.Decrement />
        <NumberField.Input aria-label="Disabled quantity" />
        <NumberField.Increment />
      </NumberField.Root>
    </div>
    <div class="control">
      <h2>Read only</h2>
      <NumberField.Root id="readonly-quantity" value={2} min={0} max={9} readOnly size="sm">
        <NumberField.Decrement />
        <NumberField.Input aria-label="Read-only quantity" />
        <NumberField.Increment />
      </NumberField.Root>
    </div>
    <div class="control">
      <h2>Masked code</h2>
      <label for="masked-code">Backup code</label>
      <PinInput.Root bind:value={disabledCode} inputId="masked-code" maxlength={4} mask disabled size="sm">
        {#snippet children({ cells })}
          {#each cells as cell, index (index)}<PinInput.Cell {cell} />{/each}
        {/snippet}
      </PinInput.Root>
    </div>
  </section>

  <section dir="rtl" lang="ar" class="rtl">
    <h2>اتجاه من اليمين إلى اليسار</h2>
    <label for="arabic-quantity">الكمية</label>
    <NumberField.Root id="arabic-quantity" bind:value={amount} min={0} max={999} locale="ar-EG" dir="rtl">
      <NumberField.Decrement aria-label="تقليل الكمية" />
      <NumberField.Input aria-label="الكمية" />
      <NumberField.Increment aria-label="زيادة الكمية" />
    </NumberField.Root>
  </section>

</section>

<style>
  .demo {
    min-inline-size: 0;
    max-inline-size: min(100%, 40rem);
    display: grid;
    gap: 1.25rem;
    padding: 1.5rem;
    color: var(--tx-foreground, CanvasText);
    background: var(--tx-background, Canvas);
    font-family: var(--tx-font-sans, system-ui, sans-serif);
  }
  section, .control { display: grid; gap: 0.5rem; }
  h2 { margin: 0; font-size: 0.9rem; font-weight: 600; }
  label { font-size: 0.875rem; font-weight: 500; }
  .row { display: flex; flex-wrap: wrap; align-items: start; gap: 1rem; }
  .rtl :global(.tx-number-field) { justify-self: start; }
  @media (max-width: 36rem) { .demo { padding: 1rem; } }
</style>
