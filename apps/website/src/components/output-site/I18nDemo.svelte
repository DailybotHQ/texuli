<script lang="ts">
/**
 * /output-page/ live locale switch: one `I18n` from `@texuli/core/i18n`
 * put in context with `setI18nContext`, so every Texuli label below
 * resolves instance prop → catalog → English default and re-renders when
 * the locale changes. Spanish is a catalog this page wrote for the demo
 * (`./locales/es.ts`), loaded lazily the first time it is picked;
 * `en-XA` is the built-in pseudo-locale, which brackets every string that
 * went through the catalog, so text that did not stands out. The plural
 * line formats through `Intl.PluralRules` for the active locale.
 */
import { createI18n, PSEUDO_LOCALE } from '@texuli/core/i18n';
import { onMount } from 'svelte';
import { setI18nContext } from 'texuli';
import { CopyButton } from 'texuli/kbd-code';
import { Rating } from 'texuli/rating';
import { TagsInput } from 'texuli/tags-color';

const LOCALES = [
  { id: 'en', label: 'English (shipped)' },
  { id: 'es', label: 'Español (this page’s catalog, lazy)' },
  { id: PSEUDO_LOCALE, label: 'Pseudo-locale (en-XA)' },
] as const;

const i18n = createI18n({
  locale: 'en',
  catalogs: [
    {
      locale: 'en',
      messages: {
        'demo.files': { plural: 'count', '=0': 'No files', one: '# file', other: '# files' },
      },
    },
  ],
  loaders: { es: () => import('./locales/es.ts') },
});
setI18nContext(i18n);

let locale = $state('en');
let status = $state('English is active.');
let version = $state(0);
let rating = $state(3);
let tags = $state(['launch', 'billing']);
let files = $state(1);
let loaded = $state.raw<readonly string[]>(['en']);

const plural = $derived.by(() => {
  void version;
  return i18n.t('demo.files', '{count} files', { count: files });
});

onMount(() =>
  i18n.subscribe(() => {
    version += 1;
  })
);

async function choose(next: string): Promise<void> {
  status = next === 'es' && !loaded.includes('es') ? 'Loading the Spanish catalog…' : '';
  const ok = await i18n.setLocale(next);
  locale = i18n.locale;
  if (ok && !loaded.includes(next)) loaded = [...loaded, next];
  status = ok
    ? `${LOCALES.find((entry) => entry.id === next)?.label ?? next} is active.`
    : `${next} could not load.`;
}
</script>

<div class="i18n" data-output-i18n="">
  <fieldset class="i18n__locales">
    <legend>Locale</legend>
    {#each LOCALES as option (option.id)}
      <label class="i18n__choice">
        <input
          type="radio"
          name="output-locale"
          value={option.id}
          checked={locale === option.id}
          onchange={() => choose(option.id)}
        />
        {option.label}
      </label>
    {/each}
  </fieldset>
  <p class="i18n__status" role="status" data-output-i18n-status="">{status}</p>
  <div class="i18n__stage" lang={locale} data-output-i18n-stage={locale}>
    <div class="i18n__row">
      <Rating bind:value={rating} showValue />
    </div>
    <div class="i18n__row">
      <TagsInput bind:value={tags} label="Topics" />
    </div>
    <div class="i18n__row i18n__row--inline">
      <code>npm install texuli</code>
      <CopyButton value="npm install texuli" />
    </div>
    <div class="i18n__row i18n__row--inline">
      <label class="i18n__count">
        <span>Files</span>
        <input type="number" min="0" max="20" bind:value={files} />
      </label>
      <output data-output-i18n-plural="">{plural}</output>
    </div>
  </div>
  <p class="i18n__note">
    The tag group’s name, “Topics”, is an instance prop, so it stays as written in every locale;
    the rest come from the catalog. Catalogs loaded: {loaded.join(', ')}.
  </p>
</div>

<style>
  .i18n {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 0.6rem;
    min-inline-size: 0;
    padding: clamp(0.75rem, 2vw, 1.25rem);
    border: 1px solid var(--tx-border, CanvasText);
    border-radius: 1rem;
    background: var(--tx-surface, Canvas);
    color: var(--tx-foreground, CanvasText);
  }
  .i18n__locales {
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem 1rem;
    margin: 0;
    padding: 0.4rem 0.75rem 0.6rem;
    border: 1px solid var(--tx-border, CanvasText);
    border-radius: 0.6rem;
    font-size: 0.875rem;
  }
  .i18n__locales legend {
    padding-inline: 0.25rem;
    font-weight: 600;
  }
  .i18n__choice {
    display: inline-flex;
    gap: 0.35rem;
    align-items: center;
    min-block-size: 1.75rem;
  }
  .i18n__status,
  .i18n__note {
    margin: 0;
    min-block-size: 1.25rem;
    font-size: 0.875rem;
  }
  .i18n__stage {
    display: grid;
    gap: 0.75rem;
    padding: 0.75rem;
    border: 1px dashed var(--tx-border, CanvasText);
    border-radius: 0.75rem;
    background: var(--tx-background, Canvas);
  }
  .i18n__row {
    min-inline-size: 0;
  }
  .i18n__row--inline {
    display: flex;
    flex-wrap: wrap;
    gap: 0.6rem;
    align-items: center;
  }
  .i18n__count {
    display: inline-flex;
    gap: 0.4rem;
    align-items: center;
    font-size: 0.875rem;
    font-weight: 600;
  }
  .i18n__count input {
    inline-size: 4.5rem;
    min-block-size: 2rem;
    padding-inline: 0.4rem;
    border: 1px solid var(--tx-border, ButtonBorder);
    border-radius: 0.4rem;
    background: var(--tx-background, Field);
    color: var(--tx-foreground, FieldText);
    font: inherit;
  }
  .i18n__count input:focus-visible {
    outline: 2px solid var(--tx-ring, Highlight);
    outline-offset: 2px;
  }
</style>
