<script lang="ts">
import DeckDemo from './DeckDemo.svelte';
import { reportDeck } from './samples.ts';
</script>

<DeckDemo deck={reportDeck()} initialSlideId="trend" label="Report template" />
