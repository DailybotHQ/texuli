import type { SolutionEntry } from '../../../../data/solutions/schema.ts';
import type { SolutionQuickstartProps } from '../../shared/types.ts';

export const AGENT_CHAT_QUICKSTART_VERIFIED_BY = 'tests/e2e/site-solution-agent-chat.spec.ts';

export const AGENT_CHAT_THREAD_SAMPLE = `<script lang="ts">
import { applyChatStreamEvent, type ChatMessage, ChatThread } from '@texuli/chat';

let messages = $state<ChatMessage[]>([]);
const agent = { id: 'agent', name: 'Example agent' };

function onSend(body: string) {
  messages = [...messages, { id: crypto.randomUUID(), author: { id: 'me', name: 'Me' }, at: Date.now(), body }];
  const id = crypto.randomUUID();
  messages = applyChatStreamEvent(messages, { type: 'start', id, author: agent, at: Date.now() });
  messages = applyChatStreamEvent(messages, { type: 'delta', id, text: 'Hello from **example.com**.' });
  messages = applyChatStreamEvent(messages, { type: 'end', id });
}
</script>

<ChatThread {messages} currentUserId="me" {onSend} />`;

export const AGENT_CHAT_ATTACHMENT_SAMPLE = `<script lang="ts">
import { validateDraft } from '@texuli/catalog/validate';
import { ChatAttachment } from '@texuli/chat';
import { createPlayerCatalog, Player } from '@texuli/player';

let { blueprint }: { blueprint: unknown } = $props();
const catalog = createPlayerCatalog();
const check = (artifact: unknown) => {
  const result = validateDraft(artifact, { catalog, tier: 'untrusted' });
  return result.ok && result.draft
    ? { ok: true as const, value: result.draft }
    : { ok: false as const, reasons: result.diagnostics.map((d) => d.message) };
};
</script>

<ChatAttachment artifact={blueprint} title="Report" {check}>
  {#snippet preview(value)}<Player blueprint={value} label="Report" />{/snippet}
</ChatAttachment>`;

export function agentChatQuickstart(entry: SolutionEntry): SolutionQuickstartProps {
  return {
    entry,
    title: 'Start with a thread',
    install: { label: 'Install', language: 'bash', code: 'pnpm add @texuli/chat@0.17.4' },
    samples: [
      { label: 'Stream a reply', language: 'svelte', code: AGENT_CHAT_THREAD_SAMPLE },
      {
        label: 'Attach a blueprint (in development, not in a published release yet)',
        language: 'svelte',
        code: AGENT_CHAT_ATTACHMENT_SAMPLE,
      },
    ],
    verifiedBy: AGENT_CHAT_QUICKSTART_VERIFIED_BY,
  };
}
