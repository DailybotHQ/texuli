<script lang="ts">
import { applyChatStreamEvent, type ChatMessage, ChatThread } from '@texuli/chat';

const currentUserId = 'person-avery';
const authors = {
  avery: { id: currentUserId, name: 'Avery Chen' },
  jordan: { id: 'person-jordan', name: 'Jordan Lee' },
  sam: { id: 'agent-sam', name: 'Sam Rivera' },
};
let messages = $state<ChatMessage[]>([
  {
    id: 'm-1',
    author: authors.jordan,
    at: '2026-06-12T14:00:00.000Z',
    body: 'Morning! I pulled together a quick **release checklist**.',
  },
  {
    id: 'm-2',
    author: authors.jordan,
    at: '2026-06-12T14:01:00.000Z',
    body: 'The preview is ready at [preview.example](https://preview.example).',
  },
  {
    id: 'm-3',
    author: authors.avery,
    at: '2026-06-12T14:03:00.000Z',
    body: 'Great, I will review the `keyboard` path first.',
  },
  {
    id: 'm-4',
    author: authors.sam,
    at: '2026-06-12T14:05:00.000Z',
    body: 'I found one detail to check: *focus returns to the trigger* after closing.',
  },
  {
    id: 'm-5',
    author: authors.jordan,
    at: '2026-06-12T14:07:00.000Z',
    body: 'Thanks, I will update the notes and share another preview.',
  },
]);
let draft = $state('');
let nextId = 6;

function simulateStream(): void {
  const id = 'streamed-reply';
  messages = applyChatStreamEvent(messages, {
    type: 'start',
    id,
    author: authors.sam,
    at: '2026-06-12T14:12:00.000Z',
  });
  messages = applyChatStreamEvent(messages, { type: 'delta', id, text: 'Streamed reply: ' });
  messages = applyChatStreamEvent(messages, { type: 'delta', id, text: 'review is complete.' });
  messages = applyChatStreamEvent(messages, { type: 'end', id, status: 'sent' });
}

async function send(body: string): Promise<void> {
  const sentAt = new Date('2026-06-12T14:10:00.000Z').getTime() + nextId * 60_000;
  messages = [
    ...messages,
    { id: `m-${nextId}`, author: authors.avery, at: sentAt, body, status: 'sent' },
  ];
  nextId += 1;
}
</script>

<section class="demo" aria-labelledby="chat-thread-heading">
  <div class="demo__heading">
    <div>
      <h2 id="chat-thread-heading">Release planning</h2>
      <p>Three fictional participants · consecutive messages are grouped.</p>
    </div>
    <button
      type="button"
      class="demo__history"
      onclick={() => {
        messages = Array.from({ length: 180 }, (_, index) => ({
          id: `history-${index}`,
          author: index % 3 === 0 ? authors.avery : index % 3 === 1 ? authors.jordan : authors.sam,
          at: Date.UTC(2026, 5, 12, 10, 0, index * 30),
          body: index % 5 === 0 ? `A longer note for history item ${index + 1} with **safe emphasis**.` : `History note ${index + 1}.`,
        }));
      }}
    >
      Load long history
    </button>
    <button
      type="button"
      class="demo__history"
      disabled={messages.length < 100}
      onclick={() => {
        const first = messages[0];
        const firstAt = first
          ? first.at instanceof Date
            ? first.at.getTime()
            : new Date(first.at).getTime()
          : Date.UTC(2026, 5, 12, 10);
        const start = firstAt - 10 * 60_000;
        const older = Array.from({ length: 10 }, (_, index) => ({
          id: `older-${index}`,
          author: authors.jordan,
          at: start + index * 30_000,
          body: `Earlier note ${index + 1}.`,
        }));
        messages = [...older, ...messages];
      }}
    >
      Load earlier messages
    </button>
    <button type="button" class="demo__history" onclick={simulateStream}>
      Simulate a streamed reply
    </button>
  </div>
  <ChatThread {messages} {currentUserId} bind:draft onSend={send} typing={['Jordan Lee']}>
    {#snippet header()}
      <div class="demo__thread-header"><span class="demo__presence"></span> #release-planning</div>
    {/snippet}
  </ChatThread>
</section>

<style>
  .demo { display: flex; inline-size: min(100%, 42rem); block-size: 36rem; flex-direction: column; overflow: hidden; border: 1px solid var(--tx-border, ButtonBorder); border-radius: 0.75rem; background: var(--tx-surface, Canvas); color: var(--tx-foreground, CanvasText); }
  .demo__heading { display: flex; align-items: center; justify-content: space-between; gap: 1rem; padding: 1rem; }
  .demo__heading h2, .demo__heading p { margin: 0; }
  .demo__heading h2 { font-size: 1rem; }
  .demo__heading p { margin-block-start: 0.25rem; color: var(--tx-muted-foreground, GrayText); font-size: 0.8rem; }
  .demo__history { min-block-size: 2.5rem; border: 1px solid var(--tx-border, ButtonBorder); border-radius: 0.5rem; background: transparent; color: inherit; padding-inline: 0.75rem; cursor: pointer; }
  .demo__history:focus-visible { outline: 2px solid var(--tx-ring, Highlight); outline-offset: 2px; }
  .demo__thread-header { display: flex; align-items: center; gap: 0.5rem; border-block: 1px solid var(--tx-border, ButtonBorder); padding: 0.75rem 1rem; font-weight: 600; }
  .demo__presence { inline-size: 0.5rem; block-size: 0.5rem; border-radius: 50%; background: var(--tx-success, #16834a); }
</style>
