<script lang="ts">
import {
  applyChatStreamEvent,
  ChatAttachment,
  type ChatAttachmentCheck,
  type ChatMessage,
  ChatThread,
  commandSuggestions,
  mentionSuggestions,
} from '@texuli/chat';
import { parseMarkdown } from '@texuli/core/markdown';
import { type MarkdownDialect, writeMarkdownDialect } from '@texuli/core/markdown-dialects';
import type { Component } from 'svelte';
import MessageBody from './MessageBody.svelte';
import {
  AGENT,
  type ChatScenario,
  COMMANDS,
  chunks,
  FALLBACK_REPLY,
  PEOPLE,
  SCENARIOS,
  type ScenarioAttachment,
  scenarioFor,
  YOU,
} from './scenarios.ts';

/** The validator and the painter, loaded the first time a reply attaches a blueprint. */
interface AttachmentTools {
  readonly check: (artifact: unknown) => ChatAttachmentCheck;
  readonly Player: Component<{ blueprint: unknown; label: string }>;
}

// Fixed clock: server and browser render the same timestamps.
const START = Date.UTC(2026, 10, 12, 9, 0, 0);
let counter = 0;
const stamp = () => new Date(START + counter * 60_000).toISOString();

let messages = $state<ChatMessage[]>([
  {
    id: 'welcome',
    author: AGENT,
    at: new Date(START).toISOString(),
    body: 'Hi! I answer from fixtures, with no live model. Pick a scenario, or type `/` for a command and `@` to mention a teammate.',
  },
]);
let attachments = $state<Record<string, readonly ScenarioAttachment[]>>({});
let tools = $state<AttachmentTools | null>(null);
let streamingId = $state<string | null>(null);
let draft = $state('');
let dialect = $state<MarkdownDialect>('slack');
let timer: ReturnType<typeof setTimeout> | undefined;

const suggestions = [mentionSuggestions(PEOPLE), commandSuggestions(COMMANDS)];
const DIALECTS: readonly { id: MarkdownDialect; label: string }[] = [
  { id: 'slack', label: 'Slack' },
  { id: 'discord', label: 'Discord' },
  { id: 'teams', label: 'Microsoft Teams' },
  { id: 'whatsapp', label: 'WhatsApp' },
  { id: 'plain-text', label: 'Plain text' },
];

const lastReply = $derived(
  [...messages].reverse().find((message) => message.author.id === AGENT.id && !message.streaming)
);
const exported = $derived.by(() => {
  if (!lastReply) return { value: '', changes: 0 };
  const written = writeMarkdownDialect(parseMarkdown(lastReply.body).tree, dialect);
  return { value: written.value, changes: written.diagnostics.length };
});

async function loadTools(): Promise<AttachmentTools> {
  if (tools) return tools;
  const [{ validateDraft }, player] = await Promise.all([
    import('@texuli/catalog/validate'),
    import('@texuli/player'),
  ]);
  const catalog = player.createPlayerCatalog();
  const loaded: AttachmentTools = {
    Player: player.Player as unknown as AttachmentTools['Player'],
    // The same checks the player runs before it paints: the local-state wrapper, the catalog
    // at the untrusted tier, and form fields bound to declared state.
    check(artifact) {
      const split = player.splitStatefulBlueprint(artifact);
      if (split.kind === 'invalid')
        return {
          ok: false,
          reasons: split.issues.map((issue) => `${issue.code}: ${issue.message}`),
        };
      const declarations = split.kind === 'stateful' ? split.declarations : null;
      const result = validateDraft(split.blueprint, { catalog, tier: 'untrusted' });
      const reasons = [
        ...result.diagnostics
          .filter((diagnostic) => diagnostic.severity === 'error')
          .map((diagnostic) => `${diagnostic.code}: ${diagnostic.message}`),
        ...player
          .checkActionNodes(split.blueprint, declarations)
          .map((issue) => `${issue.code}: ${issue.message}`),
      ];
      return reasons.length === 0 && result.ok
        ? { ok: true, value: artifact, summary: 'Validated at the untrusted tier.' }
        : { ok: false, reasons };
    },
  };
  tools = loaded;
  return loaded;
}

function reply(scenario: ChatScenario | undefined): void {
  counter += 1;
  const id = `reply-${counter}`;
  const reduced =
    typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const parts = chunks(scenario?.reply ?? FALLBACK_REPLY);
  messages = applyChatStreamEvent(messages, { type: 'start', id, author: AGENT, at: stamp() });
  streamingId = id;
  let index = 0;
  const step = async () => {
    if (streamingId !== id) return;
    if (index < parts.length) {
      messages = applyChatStreamEvent(messages, { type: 'delta', id, text: parts[index] ?? '' });
      index += 1;
      timer = setTimeout(step, reduced ? 0 : 35);
      return;
    }
    if (scenario?.attachments.length) {
      await loadTools();
      if (streamingId !== id) return;
      attachments = { ...attachments, [id]: scenario.attachments };
    }
    messages = applyChatStreamEvent(messages, { type: 'end', id });
    streamingId = null;
  };
  void step();
}

function send(text: string): boolean | undefined {
  if (streamingId) return false;
  counter += 1;
  messages = [
    ...messages,
    { id: `you-${counter}`, author: YOU, at: stamp(), body: text, status: 'sent' },
  ];
  reply(scenarioFor(text));
  return undefined;
}

function stop(): void {
  if (!streamingId) return;
  clearTimeout(timer);
  messages = applyChatStreamEvent(messages, { type: 'end', id: streamingId, stopped: true });
  streamingId = null;
}

$effect(() => () => clearTimeout(timer));
</script>

<div class="agent-chat-demo" data-tx-agent-chat-demo>
  <div class="scenarios" role="group" aria-label="Scenarios">
    {#each SCENARIOS as scenario (scenario.id)}
      <button
        type="button"
        class="scenario"
        disabled={streamingId !== null}
        onclick={() => send(scenario.prompt)}
        data-scenario={scenario.id}
      >
        {scenario.label}
      </button>
    {/each}
  </div>

  <div class="thread">
    <ChatThread
      {messages}
      currentUserId={YOU.id}
      bind:draft
      onSend={send}
      streaming={streamingId !== null}
      onStop={stop}
      {suggestions}
      label="Conversation with the demo agent"
      locale="en"
    >
      {#snippet body(message)}
        <MessageBody text={message.body} />
        {#if tools}
          {@const Player = tools.Player}
          {#each attachments[message.id] ?? [] as attachment (attachment.title)}
            <ChatAttachment
              class="attachment"
              artifact={attachment.blueprint}
              title={attachment.title}
              check={tools.check}
            >
              {#snippet preview(value)}
                <Player blueprint={value} label={attachment.title} />
              {/snippet}
            </ChatAttachment>
          {/each}
        {/if}
      {/snippet}
    </ChatThread>
  </div>

  <section class="export" aria-labelledby="agent-chat-export-title">
    <h3 id="agent-chat-export-title">Copy the last reply for another chat</h3>
    <label class="export-choice">
      <span>Format</span>
      <select bind:value={dialect}>
        {#each DIALECTS as option (option.id)}
          <option value={option.id}>{option.label}</option>
        {/each}
      </select>
    </label>
    <pre class="export-output" tabindex="0" aria-label="Last reply as {DIALECTS.find((option) => option.id === dialect)?.label}" data-tx-agent-chat-export>{exported.value}</pre>
    <p class="export-note">
      {exported.changes === 0
        ? 'Every construct has a direct spelling in this format.'
        : `${exported.changes} construct${exported.changes === 1 ? '' : 's'} adapted for this format.`}
    </p>
  </section>
</div>

<style>
  .agent-chat-demo {
    display: grid;
    gap: var(--tx-space-3);
    color: var(--tx-foreground, CanvasText);
  }

  .scenarios {
    display: flex;
    flex-wrap: wrap;
    gap: var(--tx-space-2);
  }

  .scenario {
    border: var(--tx-border-width-thin) solid var(--tx-border, ButtonBorder);
    border-radius: var(--tx-shape-radius-full);
    background: var(--tx-surface, Canvas);
    color: var(--tx-foreground, CanvasText);
    padding: var(--tx-space-1) var(--tx-space-3);
    font: inherit;
    cursor: pointer;
  }

  .scenario:focus-visible {
    outline: 2px solid var(--tx-ring, Highlight);
    outline-offset: 2px;
  }

  .scenario:disabled {
    cursor: not-allowed;
    opacity: 0.6;
  }

  .thread {
    display: flex;
    block-size: min(80vh, 40rem);
    min-block-size: 0;
    border: var(--tx-border-width-thin) solid var(--tx-border, ButtonBorder);
    border-radius: var(--tx-shape-radius-lg);
    overflow: hidden;
  }

  .thread :global(.attachment) {
    margin-block-start: var(--tx-space-2);
  }

  .export {
    display: grid;
    gap: var(--tx-space-2);
  }

  .export h3 {
    margin: 0;
    font-size: var(--tx-type-body-size);
  }

  .export-choice {
    display: flex;
    align-items: center;
    gap: var(--tx-space-2);
  }

  .export-choice select {
    border: var(--tx-border-width-thin) solid var(--tx-input, var(--tx-border, ButtonBorder));
    border-radius: var(--tx-shape-radius-md);
    background: var(--tx-surface, Canvas);
    color: var(--tx-foreground, CanvasText);
    padding: var(--tx-space-1) var(--tx-space-2);
    font: inherit;
  }

  .export-output {
    margin: 0;
    max-block-size: 12rem;
    overflow: auto;
    border-radius: var(--tx-shape-radius-md);
    background: var(--tx-muted, var(--tx-surface, Canvas));
    color: var(--tx-foreground, CanvasText);
    padding: var(--tx-space-3);
    font-family: var(--tx-font-mono, ui-monospace, monospace);
    font-size: var(--tx-type-label-size);
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }

  .export-note {
    margin: 0;
    color: var(--tx-muted-foreground, GrayText);
    font-size: var(--tx-type-label-size);
  }
</style>
