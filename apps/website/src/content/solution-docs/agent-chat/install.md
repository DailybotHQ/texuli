## Install and status

Install the published chat package with `pnpm add @texuli/chat`. It is pre-1.0, so a new minor version may break the API. The thread, message list, composer, typing indicator and streaming events are on npm.

Composer autocomplete, stopped replies and `ChatAttachment` were added after `0.17.4`. They are in this development branch and not in a published release yet. Message text renders emoji with `EmojiText` from `texuli/emoji`, loaded the first time a message holds one. Texuli's own emoji art is still landing, so emoji show as Unicode.

```svelte
<script lang="ts">
import { type ChatMessage, ChatThread } from '@texuli/chat';

let messages = $state<ChatMessage[]>([]);
</script>

<ChatThread {messages} currentUserId="me" onSend={(body) => console.log(body)} />
```
