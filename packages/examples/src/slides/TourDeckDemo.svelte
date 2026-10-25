<script lang="ts">
import DeckDemo from './DeckDemo.svelte';
import { tourDeck } from './samples.ts';
</script>

<DeckDemo deck={tourDeck()} label="Slides tour" />
