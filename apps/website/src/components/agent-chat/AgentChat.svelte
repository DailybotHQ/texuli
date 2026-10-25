<script lang="ts">
/**
 * The texuli.com chat island for the agent service. Messages render through
 * the chat thread (plain text via parseMessageText, never HTML); drafts are
 * painted by the player in the untrusted tier, which re-validates them and
 * applies the URL policy at paint. Drafts are never activated here.
 */
import { type ChatMessage, ChatThread } from '@texuli/chat';
import { Player } from '@texuli/player';
import { onMount } from 'svelte';
import {
  type AgentDraftResult,
  type AgentStreamEvent,
  type Connection,
  connect,
  requestDraft,
  type Unavailable,
} from './client.ts';
import {
  applyStreamEvent,
  draftLifecycle,
  envelopeStatus,
  type LifecycleInput,
  type StreamStep,
} from './lifecycle.ts';

type Props = {
  /** The service origin, or `null` when the site was built without one. */
  endpoint: string | null;
  catalogHash: string;
  /** Injected in tests; the browser's fetch otherwise. */
  fetcher?: typeof fetch;
};

let { endpoint, catalogHash, fetcher }: Props = $props();

const YOU = { id: 'you', name: 'You' };
const AGENT = { id: 'agent', name: 'Texuli agent' };
const PRESETS = [
  {
    label: 'Weekly report',
    prompt: 'Build a weekly report for the fictional Harbor support team.',
  },
  { label: 'Dashboard', prompt: 'Make a dashboard of ticket volume by channel.' },
  { label: 'Planning deck', prompt: 'Prepare a three-point planning deck for Monday.' },
] as const;
const UNAVAILABLE: Record<Unavailable, string> = {
  'not-configured':
    'The agent service is not running on texuli.com yet, so nothing you type is sent anywhere.',
  disabled: 'The agent is turned off right now. Please try again later.',
  offline: 'The agent cannot be reached right now. Please try again later.',
  'catalog-mismatch': 'The agent runs a different catalog version. Reload the page to update.',
};

let connection = $state<Connection | null>(null);
let messages = $state<ChatMessage[]>([]);
let draftText = $state('');
let working = $state(false);
let progress = $state('');
let latest = $state<AgentDraftResult | null>(null);
/** The steps the service streamed for the current or last request. */
let steps = $state<StreamStep[]>([]);
let phase = $state<LifecycleInput>({ phase: 'idle' });
/** Codes of the last answer the service rejected, shown instead of a preview. */
let rejectedCodes = $state<string[]>([]);
let sequence = 0;

let ready = $derived(connection?.ok === true);
let unavailable = $derived(connection !== null && !connection.ok ? connection.reason : null);
let lifecycle = $derived(draftLifecycle(phase));
let stamped = $derived(envelopeStatus(latest));
let checks = $derived(
  latest ? Object.entries(latest.receipt.checks).filter(([, status]) => status !== 'skipped') : []
);

onMount(() => {
  let alive = true;
  connect(endpoint, catalogHash, fetcher ?? fetch).then((result) => {
    if (alive) connection = result;
  });
  return () => {
    alive = false;
  };
});

function add(author: typeof YOU, body: string, status?: ChatMessage['status']) {
  sequence += 1;
  messages = [
    ...messages,
    { id: `m${sequence}`, author, body, at: Date.now(), ...(status ? { status } : {}) },
  ];
}

function onEvent(event: AgentStreamEvent) {
  steps = applyStreamEvent(steps, event);
  if (event.type === 'generating' || event.type === 'validating') {
    phase = { phase: 'working', drafted: true };
  }
  const last = steps.at(-1);
  if (last && event.type !== 'done') progress = `${last.label}.`;
}

async function send(text: string) {
  const prompt = text.trim();
  if (!prompt || working || connection?.ok !== true) return;
  const history = messages.slice(-6).map((m) => ({
    role: m.author.id === YOU.id ? 'user' : 'assistant',
    text: m.body,
  }));
  add(YOU, prompt);
  draftText = '';
  working = true;
  progress = 'Sending…';
  steps = [];
  rejectedCodes = [];
  phase = { phase: 'working', drafted: false };
  const outcome = await requestDraft(
    connection,
    { prompt, catalogHash, history, ...(latest?.draft ? { draft: latest.draft } : {}) },
    onEvent,
    fetcher ? { fetch: fetcher } : {}
  );
  working = false;
  progress = '';
  if (outcome.result) {
    add(AGENT, outcome.result.note);
    phase = { phase: 'result', result: outcome.result };
    if (outcome.result.status === 'valid') latest = outcome.result;
    else rejectedCodes = [...new Set(outcome.result.diagnostics.map((d) => d.code))].slice(0, 6);
  } else if (outcome.error) {
    add(AGENT, outcome.error.message, 'failed');
    phase = { phase: 'error', message: outcome.error.message };
    if (outcome.error.code === 'unavailable') connection = { ok: false, reason: 'disabled' };
  }
}
</script>

<section class="agent-chat" aria-labelledby="agent-chat-title" data-tx-agent-chat>
  <div class="agent-chat__chat">
    <h2 id="agent-chat-title" class="agent-chat__title">Conversation</h2>
    <p class="agent-chat__deployment" data-tx-agent-deployment={ready ? 'connected' : 'not-deployed'}>
      {#if ready && connection?.ok}
        Connected to the agent service at <code>{connection.endpoint}</code>. texuli.com itself does
        not host the agent yet; this is a development setup.
      {:else}
        Not deployed: texuli.com does not run the agent service. In local development it runs
        against <code>pnpm --filter @texuli/agent dev</code>, which answers with recorded replies
        (no model, no key).
      {/if}
    </p>
    {#if unavailable}
      <p class="agent-chat__notice" role="status" data-tx-agent-unavailable={unavailable}>
        {UNAVAILABLE[unavailable]}
      </p>
    {:else if connection === null}
      <p class="agent-chat__notice" role="status">Checking the agent service…</p>
    {/if}

    <div class="agent-chat__presets" role="group" aria-label="Example prompts">
      {#each PRESETS as preset (preset.label)}
        <button type="button" disabled={!ready || working} onclick={() => send(preset.prompt)}>
          {preset.label}
        </button>
      {/each}
    </div>

    <div class="agent-chat__thread">
      <ChatThread
        {messages}
        currentUserId={YOU.id}
        bind:draft={draftText}
        onSend={send}
        sending={working}
        disabled={!ready}
        placeholder="Describe a report, dashboard or deck"
        emptyText="Ask for a report, a dashboard or a deck. The agent answers with a validated draft."
      />
    </div>
    <p class="agent-chat__progress" role="status" aria-live="polite">{progress}</p>
    {#if steps.length}
      <ol class="agent-chat__steps" aria-label="Request steps" data-tx-agent-steps>
        {#each steps as step (step.key)}
          <li data-state={step.state}>
            <span class="agent-chat__step-mark" aria-hidden="true"
              >{step.state === 'done' ? '✓' : step.state === 'failed' ? '✕' : '…'}</span
            >
            <span>{step.label}</span>
            <span class="visually-hidden">
              ({step.state === 'done' ? 'done' : step.state === 'failed' ? 'failed' : 'in progress'})
            </span>
          </li>
        {/each}
      </ol>
    {/if}
  </div>

  <section class="agent-chat__preview" aria-labelledby="agent-preview-title">
    <div class="agent-chat__preview-head">
      <h2 id="agent-preview-title" class="agent-chat__title">Draft preview</h2>
      <span class="agent-chat__badge">Draft · untrusted · not activated</span>
    </div>
    <ol class="agent-chat__lifecycle" aria-label="Draft lifecycle" data-tx-agent-lifecycle>
      {#each lifecycle as step (step.stage)}
        <li data-stage={step.stage} data-state={step.state} aria-current={step.state === 'current' ? 'step' : undefined}>
          <span class="agent-chat__lifecycle-label">{step.label}</span>
          <span class="agent-chat__lifecycle-detail">{step.detail}</span>
          <span class="visually-hidden">({step.state})</span>
        </li>
      {/each}
    </ol>
    {#if latest?.status === 'valid'}
      <div class="agent-chat__player">
        <Player
          blueprint={latest.envelope ?? latest.draft}
          {catalogHash}
          tier="untrusted"
          status="draft"
          label="Agent draft preview"
        />
      </div>
      <dl class="agent-chat__receipt" aria-label="Validation receipt">
        <div><dt>Model</dt><dd>{latest.receipt.model}</dd></div>
        <div><dt>Envelope</dt><dd>{stamped ?? 'none'}</dd></div>
        <div><dt>Attempts</dt><dd>{latest.receipt.attempts}</dd></div>
        <div><dt>Time</dt><dd>{latest.receipt.timing.totalMs} ms</dd></div>
        <div>
          <dt>Checks passed</dt>
          <dd>{checks.filter(([, s]) => s === 'pass').length} of {checks.length}</dd>
        </div>
      </dl>
    {:else if rejectedCodes.length}
      <p class="agent-chat__rejected" data-tx-agent-rejected>
        The service rejected the last draft, so there is nothing to preview. Validation codes:
        {rejectedCodes.join(', ')}.
      </p>
    {:else}
      <p class="agent-chat__empty">
        A validated draft appears here. It is checked again in your browser before it is shown,
        and it stays a draft: activating it is your own tool's decision.
      </p>
    {/if}
  </section>
</section>

<style>
  .agent-chat {
    display: grid;
    gap: 1rem;
    color: var(--tx-foreground, CanvasText);
  }
  @media (min-width: 1024px) {
    .agent-chat { grid-template-columns: minmax(0, 0.9fr) minmax(0, 1.1fr); align-items: start; }
  }
  .agent-chat__chat,
  .agent-chat__preview {
    display: grid;
    gap: 0.75rem;
    min-inline-size: 0;
    border: 1px solid var(--tx-border, ButtonBorder);
    border-radius: var(--tx-radius-lg, 0.75rem);
    padding: clamp(0.75rem, 2vw, 1.25rem);
    background: var(--tx-surface, Canvas);
  }
  .agent-chat__title { margin: 0; font-size: 1.1rem; }
  .agent-chat__notice {
    margin: 0;
    border-inline-start: 4px solid var(--tx-warning, Mark);
    border-radius: 0.4rem;
    padding: 0.75rem;
    background: var(--tx-muted, Canvas);
  }
  .agent-chat__presets { display: flex; flex-wrap: wrap; gap: 0.5rem; }
  .agent-chat__presets button {
    min-block-size: 44px;
    border: 1px solid var(--tx-border, ButtonBorder);
    border-radius: 999px;
    padding-inline: 1rem;
    font: inherit;
    color: inherit;
    background: var(--tx-background, Canvas);
    cursor: pointer;
  }
  .agent-chat__presets button:focus-visible { outline: 3px solid var(--tx-ring, Highlight); outline-offset: 2px; }
  .agent-chat__presets button:disabled { opacity: 0.55; cursor: not-allowed; }
  .agent-chat__thread { display: flex; min-block-size: 22rem; max-block-size: 70vh; }
  .agent-chat__progress { min-block-size: 1.25rem; margin: 0; font-size: 0.875rem; color: var(--tx-muted-foreground, GrayText); }
  .agent-chat__preview-head { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 0.5rem; }
  .agent-chat__badge {
    border: 1px solid var(--tx-border, ButtonBorder);
    border-radius: 999px;
    padding: 0.2rem 0.65rem;
    font-size: 0.75rem;
    font-weight: 600;
  }
  .agent-chat__player { overflow: auto; max-inline-size: 100%; }
  .agent-chat__empty { margin: 0; color: var(--tx-muted-foreground, GrayText); }
  .agent-chat__deployment { margin: 0; font-size: 0.875rem; color: var(--tx-muted-foreground, GrayText); }
  .agent-chat__deployment code, .agent-chat__rejected { overflow-wrap: anywhere; }
  .agent-chat__rejected { margin: 0; border-inline-start: 4px solid var(--tx-destructive, Mark); padding: 0.5rem 0.75rem; }
  .agent-chat__steps, .agent-chat__lifecycle { display: grid; gap: 0.35rem; margin: 0; padding: 0; list-style: none; }
  .agent-chat__steps li { display: flex; gap: 0.5rem; align-items: baseline; font-size: 0.875rem; }
  .agent-chat__step-mark { inline-size: 1rem; text-align: center; font-weight: 700; }
  .agent-chat__steps li[data-state='failed'] { color: var(--tx-destructive, CanvasText); }
  .agent-chat__lifecycle { grid-template-columns: repeat(auto-fit, minmax(9rem, 1fr)); }
  .agent-chat__lifecycle li { display: grid; gap: 0.15rem; border: 1px solid var(--tx-border, ButtonBorder); border-radius: 0.5rem; padding: 0.5rem 0.65rem; }
  .agent-chat__lifecycle li[data-state='upcoming'] { border-style: dashed; }
  .agent-chat__lifecycle li[data-state='current'] { border-color: var(--tx-ring, Highlight); border-width: 2px; }
  .agent-chat__lifecycle li[data-state='done'] .agent-chat__lifecycle-label::before { content: '✓ '; }
  .agent-chat__lifecycle li[data-state='failed'] { border-color: var(--tx-destructive, Mark); }
  .agent-chat__lifecycle li[data-state='failed'] .agent-chat__lifecycle-label::before { content: '✕ '; }
  .agent-chat__lifecycle-label { font-weight: 600; font-size: 0.875rem; }
  .agent-chat__lifecycle-detail { font-size: 0.75rem; color: var(--tx-muted-foreground, GrayText); }
  .visually-hidden { position: absolute; inline-size: 1px; block-size: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
  .agent-chat__receipt { display: grid; grid-template-columns: repeat(auto-fit, minmax(8rem, 1fr)); gap: 0.5rem; margin: 0; }
  .agent-chat__receipt div { border: 1px solid var(--tx-border, ButtonBorder); border-radius: 0.5rem; padding: 0.5rem 0.75rem; }
  .agent-chat__receipt dt { font-size: 0.75rem; color: var(--tx-muted-foreground, GrayText); }
  .agent-chat__receipt dd { margin: 0; font-weight: 600; overflow-wrap: anywhere; }
  @media (prefers-reduced-motion: reduce) {
    .agent-chat * { scroll-behavior: auto; transition: none; animation: none; }
  }
</style>
