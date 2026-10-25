<script lang="ts">
import DeckDemo from './DeckDemo.svelte';
import { mediaDeck } from './samples.ts';
</script>

<DeckDemo deck={mediaDeck()} view="print" label="Media deck" />
