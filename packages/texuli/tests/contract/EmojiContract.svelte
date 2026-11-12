<script lang="ts">
import type { HarnessProps } from '../../../primitives/tests/support/contract.ts';
import { Emoji, EmojiPicker, EmojiText } from '../../src/emoji/index.ts';

let { p, refs }: HarnessProps = $props();
</script>

<Emoji id="1f680" {...p('emoji/Emoji')} bind:ref={refs['emoji/Emoji']} />
<EmojiText text="Hello :rocket:" {...p('emoji/EmojiText')} bind:ref={refs['emoji/EmojiText']} />
<EmojiPicker
  id="contract-emoji-picker"
  {...p('emoji/EmojiPicker')}
  bind:ref={refs['emoji/EmojiPicker']}
/>
