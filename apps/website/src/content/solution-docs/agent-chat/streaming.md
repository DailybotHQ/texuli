## Streamed replies and Stop

Apply stream events with `applyChatStreamEvent(messages, event)`: `start`, `delta` and `end` (or `error`). Events are checked, so a malformed event changes nothing. While a reply streams, its partial text is hidden from the live log, and the finished message is announced once.

Pass `streaming` and `onStop` to the thread. Stop, or Escape in the composer, calls `onStop`. Send `{ type: 'end', id, stopped: true }` to keep the partial text and mark the reply as stopped.

```ts
messages = applyChatStreamEvent(messages, { type: 'start', id, author: agent, at: Date.now() });
messages = applyChatStreamEvent(messages, { type: 'delta', id, text: 'Here is the **summary**.' });
messages = applyChatStreamEvent(messages, { type: 'end', id, stopped: true });
```
