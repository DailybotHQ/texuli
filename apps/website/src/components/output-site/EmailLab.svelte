<script lang="ts">
/**
 * /output-page/ email lab: `renderEmail` from `@texuli/tools/email`
 * (loaded after hydration) turns the blueprint below into an email: the
 * draft is validated at the untrusted tier first, then mapped to tables
 * with inline styles and an escaped plain-text part. The HTML is shown
 * here as source text (Svelte escapes it) and can be downloaded as a file
 * this island creates; it is never inserted into this page. The rendered
 * look is the sandboxed frame beside it, written at build time.
 */
import { onMount } from 'svelte';
import { saveBlob } from '../canvas-site/download.ts';
import { EMAIL_OPTIONS, OUTPUT_DRAFTS } from './drafts.ts';

type EmailModule = typeof import('@texuli/tools/email');
type EmailResult = ReturnType<EmailModule['renderEmail']>;

let email = $state.raw<EmailModule | null>(null);
let failed = $state(false);
let chosen = $state(OUTPUT_DRAFTS[0]?.id ?? 'digest');
let text = $state(JSON.stringify(OUTPUT_DRAFTS[0]?.draft ?? {}, null, 2));
let dir = $state<'ltr' | 'rtl'>('ltr');
let preheader = $state<string>(EMAIL_OPTIONS.preheader);
let view = $state<'html' | 'text'>('html');
let saved = $state('');

const result = $derived.by((): EmailResult | null => {
  if (!email) return null;
  return email.renderEmail(text, { ...EMAIL_OPTIONS, preheader, dir });
});
const errors = $derived(result?.diagnostics.filter((entry) => entry.severity === 'error') ?? []);
const warnings = $derived(
  result?.diagnostics.filter((entry) => entry.severity === 'warning') ?? []
);

let requested = $state(false);
let live = true;
onMount(() => () => {
  live = false;
});

/** The renderer (the catalog it validates against included) loads on the first request. */
function load(): void {
  if (requested) return;
  requested = true;
  import('@texuli/tools/email').then(
    (module) => {
      if (live) email = module;
    },
    () => {
      failed = true;
    }
  );
}

function pick(id: string): void {
  const draft = OUTPUT_DRAFTS.find((entry) => entry.id === id);
  if (!draft) return;
  chosen = id;
  text = JSON.stringify(draft.draft, null, 2);
  saved = '';
}

function download(): void {
  if (!result?.ok) return;
  const label = OUTPUT_DRAFTS.find((draft) => draft.id === chosen)?.label ?? 'Edited draft';
  const name = `${label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')}.html`;
  saveBlob(new Blob([result.html], { type: 'text/html;charset=utf-8' }), name);
  saved = `Saved ${name}.`;
}
</script>

<div class="email" data-output-email="">
  <div class="email__bar" role="group" aria-label="Which blueprint to send">
    {#each OUTPUT_DRAFTS as draft (draft.id)}
      <button
        type="button"
        class="email__button"
        aria-pressed={chosen === draft.id}
        onclick={() => {
          pick(draft.id);
          load();
        }}>{draft.label}</button
      >
    {/each}
  </div>
  <div class="email__options">
    <label class="email__field email__field--wide">
      <span>Preheader</span>
      <input type="text" bind:value={preheader} maxlength="120" />
    </label>
    <label class="email__field">
      <span>Direction</span>
      <select bind:value={dir} data-output-email-dir="">
        <option value="ltr">Left to right</option>
        <option value="rtl">Right to left</option>
      </select>
    </label>
  </div>
  <label class="email__label" for="output-email-draft">Blueprint (JSON, untrusted)</label>
  <textarea
    id="output-email-draft"
    class="email__text"
    rows="8"
    spellcheck="false"
    value={text}
    oninput={(event) => {
      text = event.currentTarget.value;
      chosen = '';
      load();
    }}
  ></textarea>

  {#if !requested}
    <button type="button" class="email__button email__button--primary" onclick={load} data-output-email-render=""
      >Render the email</button
    >
  {/if}
  <div class="email__status" role="status" data-output-email-status="">
    {#if failed}
      <p>The email renderer could not load. Reload the page to try again.</p>
    {:else if !requested}
      <p>The renderer and the catalog it validates against load when you ask.</p>
    {:else if !result}
      <p>Loading the email renderer…</p>
    {:else if result.ok}
      <p data-output-email-ok="">
        Rendered: {result.html.length.toLocaleString('en')} characters of HTML and
        {result.text.length.toLocaleString('en')} of plain text{warnings.length > 0
          ? `, with ${warnings.length} warning${warnings.length === 1 ? '' : 's'}`
          : ''}.
      </p>
    {:else}
      <p class="email__refused" data-output-email-refused="">
        Refused at the untrusted tier with {errors.length} error{errors.length === 1 ? '' : 's'}: no HTML and
        no text were written.
      </p>
    {/if}
  </div>
  {#if result && result.diagnostics.length > 0}
    <ul class="email__diagnostics" aria-label="Diagnostics" data-output-email-diagnostics="">
      {#each result.diagnostics.slice(0, 8) as entry, index (index)}
        <li><strong>{entry.severity}</strong> <code>{entry.code}</code> at <code>{entry.path}</code>: {entry.message}</li>
      {/each}
    </ul>
  {/if}
  {#if result?.ok}
    <div class="email__bar" role="group" aria-label="Which part to show">
      <button type="button" class="email__button" aria-pressed={view === 'html'} onclick={() => (view = 'html')}
        >HTML source</button
      >
      <button type="button" class="email__button" aria-pressed={view === 'text'} onclick={() => (view = 'text')}
        >Plain-text part</button
      >
      <button type="button" class="email__button" onclick={download}>Download the .html</button>
    </div>
    <pre
      class="email__pre"
      tabindex="0"
      aria-label={view === 'html' ? 'Email HTML source' : 'Email plain-text part'}
      data-output-email-source={view}>{view === 'html' ? result.html : result.text}</pre>
    <p class="email__note" role="status">{saved}</p>
  {/if}
</div>

<style>
  .email {
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
  .email__bar,
  .email__options {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }
  .email__button {
    min-block-size: 2.25rem;
    padding-inline: 0.8rem;
    border: 1px solid var(--tx-border, ButtonBorder);
    border-radius: 0.5rem;
    background: var(--tx-background, ButtonFace);
    color: var(--tx-foreground, ButtonText);
    font: inherit;
    cursor: pointer;
  }
  .email__button[aria-pressed='true'] {
    border-color: var(--tx-primary, Highlight);
    background: var(--tx-primary-soft, Canvas);
    color: var(--tx-primary-soft-foreground, CanvasText);
    font-weight: 600;
  }
  .email__button--primary {
    justify-self: start;
    border-color: var(--tx-primary, Highlight);
    font-weight: 600;
  }
  .email__field {
    display: grid;
    gap: 0.25rem;
    font-size: 0.875rem;
    font-weight: 600;
  }
  .email__field--wide {
    flex: 1 1 14rem;
  }
  .email__field input,
  .email__field select,
  .email__text {
    min-block-size: 2.25rem;
    box-sizing: border-box;
    padding: 0.4rem 0.6rem;
    border: 1px solid var(--tx-border, ButtonBorder);
    border-radius: 0.5rem;
    background: var(--tx-background, Field);
    color: var(--tx-foreground, FieldText);
    font: inherit;
    font-weight: 400;
  }
  .email__text {
    inline-size: 100%;
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 0.75rem;
  }
  .email__label {
    font-size: 0.875rem;
    font-weight: 600;
  }
  .email__button:focus-visible,
  .email__field input:focus-visible,
  .email__field select:focus-visible,
  .email__text:focus-visible,
  .email__pre:focus-visible {
    outline: 2px solid var(--tx-ring, Highlight);
    outline-offset: 2px;
  }
  .email__status p,
  .email__note {
    margin: 0;
    font-size: 0.875rem;
  }
  .email__refused {
    padding: 0.5rem 0.75rem;
    border-inline-start: 4px solid var(--tx-danger, CanvasText);
    border-radius: 0.4rem;
    background: var(--tx-danger-soft, Canvas);
    color: var(--tx-danger-soft-foreground, CanvasText);
  }
  .email__diagnostics {
    display: grid;
    gap: 0.25rem;
    margin: 0;
    padding-inline-start: 1.1rem;
    font-size: 0.8125rem;
    overflow-wrap: anywhere;
  }
  .email__pre {
    margin: 0;
    max-block-size: 18rem;
    overflow: auto;
    padding: 0.6rem;
    border: 1px solid var(--tx-border, CanvasText);
    border-radius: 0.5rem;
    background: var(--tx-background, Canvas);
    font-size: 0.75rem;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }
</style>
