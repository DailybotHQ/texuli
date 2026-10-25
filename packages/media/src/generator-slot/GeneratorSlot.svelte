<script lang="ts">
import { type ClassValue, cx } from 'texuli/cx';
import {
  GENERATOR_SLOT_LIMITS,
  resolveGeneratorSlotLabels,
  runGenerator,
  statusMessage,
} from './model.ts';
import type {
  GeneratorFailureReason,
  GeneratorKind,
  GeneratorSlotStatus,
  MediaGenerator,
  SafeGeneratorOutput,
} from './types.ts';
import './generator-slot.css';

type Props = {
  generate?: MediaGenerator;
  kind?: GeneratorKind;
  prompt?: string;
  trust?: 'developer' | 'untrusted';
  allowedOrigins?: readonly string[];
  providerLabel?: string;
  generationOptions?: import('../provenance.ts').MediaGenerationOptions;
  maxPromptLength?: number;
  labels?: Partial<import('./types.ts').GeneratorSlotLabels>;
  onstatus?: (status: GeneratorSlotStatus) => void;
  onresult?: (result: SafeGeneratorOutput) => void;
  onerror?: (reason: GeneratorFailureReason) => void;
  class?: ClassValue;
};

let {
  generate,
  kind = $bindable<GeneratorKind>('image'),
  prompt = $bindable(''),
  trust = 'untrusted',
  allowedOrigins,
  providerLabel = 'host:provided',
  generationOptions,
  maxPromptLength = GENERATOR_SLOT_LIMITS.maxPromptLength,
  labels: labelOverrides,
  onstatus,
  onresult,
  onerror,
  class: className,
}: Props = $props();

const text = $derived(resolveGeneratorSlotLabels(labelOverrides));
const uid = $props.id();
const promptId = `${uid}-prompt`;
const statusId = `${uid}-status`;
const resultId = `${uid}-result`;

let status = $state<GeneratorSlotStatus>('idle');
let failure = $state<GeneratorFailureReason | undefined>(undefined);
let hostMessage = $state<string | undefined>(undefined);
let output = $state<SafeGeneratorOutput | undefined>(undefined);
let controller: AbortController | undefined;

const message = $derived(statusMessage(status, text, failure, hostMessage));
const tone = $derived(
  status === 'error' || status === 'blocked'
    ? status === 'blocked'
      ? 'blocked'
      : 'error'
    : status === 'ready'
      ? 'ready'
      : 'idle'
);
const busy = $derived(status === 'loading');

$effect(() => () => {
  controller?.abort();
});

function setStatus(next: GeneratorSlotStatus): void {
  status = next;
  onstatus?.(next);
}

async function handleGenerate(): Promise<void> {
  if (busy) return;
  controller?.abort();
  const next = new AbortController();
  controller = next;
  failure = undefined;
  hostMessage = undefined;
  output = undefined;
  setStatus('loading');

  const outcome = await runGenerator(generate, prompt, kind, {
    signal: next.signal,
    trust,
    allowedOrigins,
    maxPromptLength,
    providerLabel,
    generationOptions,
  });

  if (controller !== next) return;

  if (outcome.status === 'ready') {
    output = outcome.output;
    failure = undefined;
    hostMessage = undefined;
    setStatus('ready');
    onresult?.(outcome.output);
    return;
  }

  output = undefined;
  failure = outcome.reason;
  hostMessage = outcome.message;
  setStatus(outcome.status);
  onerror?.(outcome.reason);
}

function handleCancel(): void {
  if (!busy) return;
  controller?.abort();
  controller = undefined;
  failure = 'aborted';
  hostMessage = undefined;
  setStatus('cancelled');
  onerror?.('aborted');
}

function onPromptKeydown(event: KeyboardEvent): void {
  if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
    event.preventDefault();
    void handleGenerate();
  }
}
</script>

<div
  class={cx('tx-generator-slot', className)}
  data-tx-generator-slot
  data-status={status}
  data-kind={kind}
  aria-busy={busy ? 'true' : undefined}
>
  <label class="tx-generator-slot__prompt-label" for={promptId}>
    {text.prompt}
    <textarea
      id={promptId}
      class="tx-generator-slot__prompt"
      name="prompt"
      rows="3"
      maxlength={Math.min(maxPromptLength, GENERATOR_SLOT_LIMITS.absoluteMaxPromptLength)}
      placeholder={text.promptPlaceholder}
      bind:value={prompt}
      disabled={busy}
      aria-describedby={statusId}
      data-tx-generator-prompt
      onkeydown={onPromptKeydown}
    ></textarea>
  </label>

  <div class="tx-generator-slot__kinds" role="radiogroup" aria-label="Output kind">
    <label class="tx-generator-slot__kind">
      <input
        type="radio"
        name={`${uid}-kind`}
        value="image"
        bind:group={kind}
        disabled={busy}
      />
      {text.kindImage}
    </label>
    <label class="tx-generator-slot__kind">
      <input
        type="radio"
        name={`${uid}-kind`}
        value="video"
        bind:group={kind}
        disabled={busy}
      />
      {text.kindVideo}
    </label>
  </div>

  <div class="tx-generator-slot__actions">
    <button
      type="button"
      class="tx-generator-slot__button"
      data-tx-generator-generate
      disabled={busy}
      onclick={() => void handleGenerate()}
    >
      {text.generate}
    </button>
    <button
      type="button"
      class="tx-generator-slot__button tx-generator-slot__button--secondary"
      data-tx-generator-cancel
      disabled={!busy}
      onclick={handleCancel}
    >
      {text.cancel}
    </button>
  </div>

  <p
    id={statusId}
    class="tx-generator-slot__status"
    role="status"
    data-tone={tone}
    data-tx-generator-status
  >
    {message}
  </p>

  {#if output}
    <figure class="tx-generator-slot__result" id={resultId} data-tx-generator-result data-kind={output.kind}>
      <div class="tx-generator-slot__result-frame">
        {#if output.kind === 'image'}
          <img src={output.src} alt={output.alt} decoding="async" />
        {:else}
          <!-- Host may supply captions separately; slot does not invent tracks. -->
          <!-- svelte-ignore a11y_media_has_caption -->
          <video
            src={output.src}
            poster={output.poster}
            controls
            playsinline
            title={output.title}
          ></video>
        {/if}
      </div>
      {#if output.provenance}
        <dl class="tx-generator-slot__provenance" data-tx-generator-provenance>
          <dt>{text.provenanceSource}</dt>
          <dd>{output.provenance.source}</dd>
          {#if output.provenance.source === 'model'}
            <dt>{text.provenanceProvider}</dt>
            <dd>{output.provenance.providerLabel}</dd>
            <dt>{text.provenanceKind}</dt>
            <dd>{output.provenance.generatorKind}</dd>
            <dt>{text.provenancePromptHash}</dt>
            <dd>{output.provenance.promptHash}</dd>
            <dt>{text.provenanceOptions}</dt>
            <dd>{JSON.stringify(output.provenance.options)}</dd>
          {/if}
          <dt>{text.provenanceCreatedAt}</dt>
          <dd><time datetime={output.provenance.createdAt}>{output.provenance.createdAt}</time></dd>
        </dl>
      {/if}
      <figcaption class="tx-generator-slot__result-caption">
        {output.kind === 'image' ? output.alt : output.title}
      </figcaption>
    </figure>
  {/if}
</div>
