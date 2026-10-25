<script lang="ts">
import {
  type ClipboardLike,
  CopyButton,
  type CopyButtonSize,
} from '../../src/components/kbd-code/index.ts';

let {
  value = 'text',
  label = 'Copy',
  copiedLabel = 'Copied',
  feedbackMs = 1500,
  size = 'md' as CopyButtonSize,
  clipboard = undefined as ClipboardLike | null | undefined,
}: {
  value?: string;
  label?: string;
  copiedLabel?: string;
  feedbackMs?: number;
  size?: CopyButtonSize;
  clipboard?: ClipboardLike | null;
} = $props();
</script>

<CopyButton {value} {label} {copiedLabel} {feedbackMs} {size} {clipboard} />
