<script lang="ts">
import { Composer, TypingIndicator } from '@texuli/chat';

let draft = $state('');
let sent = $state<string[]>([]);
let failNext = $state(false);
let status = $state('');

async function send(message: string): Promise<void> {
  status = 'Sending…';
  await new Promise((resolve) => setTimeout(resolve, 250));
  if (failNext) {
    failNext = false;
    status = 'The message was kept so you can retry.';
    throw new Error('Simulated send failure');
  }
  sent = [...sent, message];
  status = 'Message sent.';
}
</script>

<section class="demo" aria-labelledby="chat-composer-title">
  <h2 id="chat-composer-title">Message composer</h2>
  <p>Enter sends. Shift+Enter adds a line. The send action preserves a draft after failure.</p>
  <label class="failure-toggle">
    <input type="checkbox" bind:checked={failNext} />
    Simulate the next send failing
  </label>
  <Composer bind:value={draft} onSubmit={send}>
    {#snippet attachments()}
      <button type="button" class="attachment" aria-label="Attach a file">＋ Attach</button>
    {/snippet}
  </Composer>
  <p class="hint">{status || 'A teammate is typing a reply.'}</p>
  <TypingIndicator names={['Jordan']} showLabel />
  <ol class="messages" aria-label="Sent messages">
    {#each sent as message, index (index)}
      <li>{message}</li>
    {/each}
  </ol>
</section>

<style>
  .demo {
    display: grid;
    gap: 0.75rem;
    inline-size: min(100%, 40rem);
    color: var(--tx-foreground, CanvasText);
  }

  h2,
  p,
  ol {
    margin: 0;
  }

  .failure-toggle {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .attachment {
    min-block-size: 2.5rem;
    border: 1px solid var(--tx-border, ButtonBorder);
    border-radius: 0.5rem;
    background: transparent;
    color: inherit;
    padding-inline: 0.75rem;
    cursor: pointer;
  }

  .attachment:focus-visible,
  .failure-toggle input:focus-visible {
    outline: 2px solid var(--tx-ring, Highlight);
    outline-offset: 2px;
  }

  .messages {
    display: grid;
    gap: 0.25rem;
    padding-inline-start: 1.5rem;
  }
</style>
