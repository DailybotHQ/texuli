<script lang="ts">
import DeckDemo from './DeckDemo.svelte';
import { slotMastersDeck } from './samples.ts';
</script>

<DeckDemo deck={slotMastersDeck()} view="print" label="Slot masters" />
