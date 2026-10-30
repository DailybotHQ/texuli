<script lang="ts">
import type { HarnessProps } from '../../../primitives/tests/support/contract.ts';
import { ChatThread, Composer, MessageList, TypingIndicator } from '../../src/index.ts';
import type { ChatMessage } from '../../src/thread/types.ts';

let { p, refs }: HarnessProps = $props();
const messages: ChatMessage[] = [
  {
    id: 'm1',
    author: { id: 'ada', name: 'Ada Example' },
    body: 'Standup at ten.',
    at: '2026-10-30T10:00:00.000Z',
  },
];
</script>

<ChatThread {messages} label="Thread" {...p('ChatThread')} bind:ref={refs.ChatThread} />
<MessageList {messages} label="Log" {...p('MessageList')} bind:ref={refs.MessageList} />
<Composer onSubmit={() => undefined} {...p('Composer')} bind:ref={refs.Composer} />
<TypingIndicator names={['Ada Example']} {...p('TypingIndicator')} bind:ref={refs.TypingIndicator} />
