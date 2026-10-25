<script lang="ts">
/**
 * Copies a block's source from the code already on the page, so the source
 * is not shipped a second time inside this island's props.
 */
import { CopyButton } from 'texuli/kbd-code';

type Props = { sourceId: string; label: string };

let { sourceId, label }: Props = $props();

let value = $state('');

$effect(() => {
  value = document.getElementById(sourceId)?.textContent ?? '';
});
</script>

<CopyButton {value} {label} disabled={!value} />
