<script lang="ts">
import { onDestroy } from 'svelte';
import { copyText } from 'texuli/kbd-code';
import { checkCodeBlock } from './check.ts';
import type { CodeBlockViewProps } from './family.ts';
import { loadCodeGrammar, resolveCodeLanguage } from './grammars.ts';
import { resolveHighlightSteps } from './highlight.ts';
import { fillCodeLabel, resolveCodeBlockLabels } from './labels.ts';
import { activeHighlightIndex, codeTokenClass } from './token-styles.ts';
import { type CodeToken, type Grammar, splitTokenLines, tokenize } from './tokenizer.ts';
import './code.css';

/**
 * The code family renderer. It takes untrusted data and renders only what
 * `checkCodeBlock` accepts; anything else becomes an inert notice. Tokens are
 * printed as text in spans colored by theme roles, never as HTML. The grammar
 * of the block's language loads on demand; until it arrives (and for `text`
 * or unknown languages) the same text shows unhighlighted.
 */
let {
  block,
  labels,
  oninvalid,
  lineNumbers,
  highlights,
  hostStep,
  step,
  copyable = true,
}: CodeBlockViewProps = $props();

const check = $derived(checkCodeBlock(block));
const text = $derived(resolveCodeBlockLabels(labels));
const uid = $props.id();
const nameId = `tx-code-name-${uid}`;

$effect(() => {
  if (!check.ok) oninvalid?.(check.issues);
});

const code = $derived(check.ok ? check.block.code : '');
const lang = $derived(check.ok ? check.block.lang : undefined);

let loaded = $state<{ lang: string | undefined; grammar: Grammar } | null>(null);
$effect(() => {
  const wanted = lang;
  let current = true;
  void loadCodeGrammar(wanted).then((grammar) => {
    if (current) loaded = grammar ? { lang: wanted, grammar } : null;
  });
  return () => {
    current = false;
  };
});

const tokenized = $derived(loaded !== null && loaded.lang === lang);
const tokens = $derived.by((): CodeToken[] => {
  if (loaded && loaded.lang === lang) return tokenize(code, loaded.grammar);
  return code === '' ? [] : [{ kind: 'plain', text: code }];
});
const lines = $derived(splitTokenLines(tokens));
// Block data sets highlights and line numbers; props override them.
const highlightSteps = $derived(
  highlights ?? (check.ok ? check.block.highlights : undefined) ?? []
);
const numbered = $derived(lineNumbers ?? (check.ok ? check.block.lineNumbers : undefined) ?? false);
const steps = $derived(resolveHighlightSteps(highlightSteps, lines.length));
const active = $derived(
  activeHighlightIndex(steps.length, step, hostStep, check.ok ? (check.block.step ?? 0) : 0)
);
const marked = $derived(new Set(active >= 0 ? steps[active] : []));
const name = $derived(
  check.ok ? (check.block.filename ?? check.block.lang?.toUpperCase() ?? text.code) : text.code
);

let status = $state<'idle' | 'copying' | 'copied' | 'failed'>('idle');
let timer: ReturnType<typeof setTimeout> | undefined;
onDestroy(() => clearTimeout(timer));

async function copy(): Promise<void> {
  clearTimeout(timer);
  status = 'copying';
  status = (await copyText(code)) ? 'copied' : 'failed';
  timer = setTimeout(() => {
    status = 'idle';
  }, 2000);
}
</script>

{#if !check.ok}
  <p class="tx-block tx-block-invalid" role="note" data-tx-block="invalid">{text.invalid}</p>
{:else}
  <figure
    class="tx-block tx-code"
    data-tx-block="code"
    data-lang={lang}
    data-grammar={lang === undefined ? undefined : (resolveCodeLanguage(lang) ?? 'none')}
    data-tokenized={tokenized || undefined}
    data-highlight-step={active >= 0 ? active : undefined}
    data-tone={check.block.tone}
  >
    <div class="tx-code__bar">
      <span id={nameId} class="tx-code__name">{name}</span>
      {#if copyable}
        <button
          type="button"
          class="tx-code__copy"
          data-state={status}
          aria-label={fillCodeLabel(text.copyName, name)}
          aria-busy={status === 'copying' || undefined}
          disabled={status === 'copying'}
          onclick={() => copy()}
        >
          <svg class="tx-code__icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            {#if status === 'copied'}
              <path d="M20 6 9 17l-5-5" />
            {:else if status === 'failed'}
              <path d="M12 8v5m0 4h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0" />
            {:else}
              <rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
            {/if}
          </svg>
          <span aria-hidden="true">{status === 'copied' ? text.copied : status === 'failed' ? text.copyFailed : text.copy}</span>
        </button>
      {/if}
    </div>
    <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
    <!-- Long lines scroll, so keyboard users must reach them (WCAG 2.1.1); a focusable scroll area needs a role to carry its name. -->
    <!-- Each line ends with a real newline except the last, so the text equals the source; line numbers are CSS content, never text. Code reads left to right even on RTL pages. -->
    <pre class="tx-code__pre" class:tx-code__pre--numbered={numbered} role="region" tabindex="0" dir="ltr" aria-labelledby={nameId}><code class="tx-code__code">{#each lines as line, index (index)}{@const number = index + 1}<svelte:element this={marked.has(number) ? 'mark' : 'span'} class="tx-code__line" data-line={number} data-highlighted={marked.has(number) || undefined}>{#each line as token, t (t)}<span class={codeTokenClass(token.kind)}>{token.text}</span>{/each}{index < lines.length - 1 ? '\n' : ''}</svelte:element>{/each}</code></pre>
    {#if check.block.caption}
      <figcaption class="tx-code__caption">{check.block.caption}</figcaption>
    {/if}
    <span class="tx-code__sr-only" aria-live="polite">{status === 'copied' ? text.copiedAnnouncement : status === 'failed' ? text.copyFailedAnnouncement : ''}</span>
  </figure>
{/if}
