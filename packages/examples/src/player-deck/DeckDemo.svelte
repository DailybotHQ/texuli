<script lang="ts">
import PlayerExample from '../player-shared/PlayerExample.svelte';
import { deckBlueprint } from './blueprint.ts';
</script>

<PlayerExample example="player-deck" label="Planning deck" blueprint={deckBlueprint} />
