<script lang="ts">
import { ChatMessageDisplay, ChatThreadDisplay } from '@texuli/chat';
</script>

<section class="demo" aria-labelledby="chat-display-title">
  <h2 id="chat-display-title">Release review transcript</h2>
  <ChatThreadDisplay label="Release review transcript">
    <ChatMessageDisplay
      author="Avery Chen"
      role="user"
      at="2026-06-12T14:00:00.000Z"
      text="@[Jordan](mention:person-jordan) Could you review the notes at https://example.com/review?"
    />
    <ChatMessageDisplay
      author="Sam Rivera"
      role="agent"
      at="2026-06-12T14:02:00.000Z"
      text={'Parsed mention: @[Jordan](mention:person-jordan). Plain text: @not-a-known-person. Literal markup stays text: <img src=x onerror=alert(1)>'}
    />
    <ChatMessageDisplay
      author="Release status"
      role="system"
      at="2026-06-12T14:03:00.000Z"
      text="The fictional review is ready."
    />
  </ChatThreadDisplay>
</section>

<style>
  .demo {
    display: grid;
    gap: 0.75rem;
    inline-size: min(100%, 44rem);
    color: var(--tx-foreground, CanvasText);
  }
  h2 {
    margin: 0;
    font-size: 1.125rem;
  }
</style>
