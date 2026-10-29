<script lang="ts">
/**
 * /whats-new/ i18n demo: a Rating whose labels come from the message
 * catalog in context (`I18N_CONTEXT`, as `setI18nContext` sets it). The
 * pseudo-locale `en-XA`
 * brackets every label that went through the catalog.
 */
import { createI18n, I18N_CONTEXT, type I18n, PSEUDO_LOCALE } from '@texuli/core/i18n';
import { setContext } from 'svelte';
import { Rating } from 'texuli/rating';

// What `setI18nContext` from `texuli` does, written out: importing the
// package root here would hoist the CSS of every component into this page.
const i18n = createI18n({ locale: 'en' });
setContext<I18n>(I18N_CONTEXT, i18n);
let pseudo = $state(false);
let value = $state(4);

async function toggle(): Promise<void> {
  await i18n.setLocale(pseudo ? PSEUDO_LOCALE : 'en');
}
</script>

<div class="hub-demo" data-hub-demo="i18n">
  <label class="hub-demo__check">
    <input type="checkbox" bind:checked={pseudo} onchange={toggle} />
    Pseudo-locale (en-XA)
  </label>
  <div lang={pseudo ? PSEUDO_LOCALE : 'en'} data-hub-locale={pseudo ? PSEUDO_LOCALE : 'en'}>
    <Rating bind:value showValue />
  </div>
</div>
