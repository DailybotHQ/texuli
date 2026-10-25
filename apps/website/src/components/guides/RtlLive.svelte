<script lang="ts">
import { Button } from 'texuli/button';
import { Field } from 'texuli/field';
import { Input } from 'texuli/input';

let dir = $state<'ltr' | 'rtl'>('rtl');
let city = $state('القاهرة');
</script>

<div class="guide-live" data-guide-live="rtl-i18n">
  <p class="guide-live__label">Live · logical layout and dir</p>
  <div class="toolbar">
    <Button
      size="sm"
      variant={dir === 'ltr' ? 'default' : 'outline'}
      aria-pressed={dir === 'ltr'}
      onclick={() => {
        dir = 'ltr';
      }}
    >
      LTR
    </Button>
    <Button
      size="sm"
      variant={dir === 'rtl' ? 'default' : 'outline'}
      aria-pressed={dir === 'rtl'}
      onclick={() => {
        dir = 'rtl';
      }}
    >
      RTL
    </Button>
  </div>
  <div {dir} lang={dir === 'rtl' ? 'ar' : 'en'} data-guide-dir={dir}>
    <Field
      label={dir === 'rtl' ? 'المدينة' : 'City'}
      description={dir === 'rtl' ? 'مثال للقراءة من اليمين إلى اليسار.' : 'Fictional city name.'}
    >
      {#snippet children(control)}
        <Input {...control.props} bind:value={city} autocomplete="off" />
      {/snippet}
    </Field>
  </div>
  <p class="hint">
    Components use logical properties (<code>inline-size</code>, <code>padding-inline</code>).
    Set <code>dir</code> on a subtree or the document — no mirrored CSS forks.
  </p>
</div>

<style>
  .toolbar {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }
  .hint {
    margin: 0;
    font-size: 0.875rem;
  }
</style>
