<script lang="ts">
import { localizeLabels } from '@texuli/core/i18n';
import { useMessages } from 'texuli/i18n';
import { DEFAULT_TEXT_BLOCK_LABELS } from '../text/labels.ts';
import RichText from '../text/RichText.svelte';

/**
 * Renders a short markdown body through the owned closed subset. No HTML sink.
 */
let { text }: { text: string } = $props();
const msg = useMessages();
const labels = $derived(localizeLabels(msg, 'blocks.text', DEFAULT_TEXT_BLOCK_LABELS));
</script>

<div class="tx-structure-body">
  <RichText source={text} {labels} />
</div>
