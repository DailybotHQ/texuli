<script lang="ts">
import PlayerExample from '../player-shared/PlayerExample.svelte';
import { legoBlueprint } from './blueprint.ts';
</script>

<PlayerExample example="lego" label="Launch workspace" blueprint={legoBlueprint} />
