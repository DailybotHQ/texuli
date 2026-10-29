<script lang="ts">
/**
 * Lists every `module` subpath of every packable package with its runtime
 * export count. `universe.generated.ts` is written by the harness into the
 * app (tests/consumers/harness.ts, from the packages' exports maps), so
 * the list renders in the server pass and again after hydration.
 */
import { UNIVERSE } from './universe.generated';

let hydrated = $state(false);
$effect(() => {
  hydrated = true;
});
</script>

<ul data-tx-consumer-universe data-hydrated={hydrated ? 'true' : 'false'} hidden>
  {#each UNIVERSE as entry (entry.specifier)}
    <li data-subpath={entry.specifier} data-exports={entry.exports}>{entry.specifier}</li>
  {/each}
</ul>
