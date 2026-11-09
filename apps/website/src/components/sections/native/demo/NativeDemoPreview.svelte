<script lang="ts">
/** Server-rendered web paint of the actual @texuli/spec report-on-demand golden. */
import { Player } from '@texuli/player';
import '@texuli/player/styles.css';
import { NATIVE_DEMO_FIXTURE } from './native-demo-data.ts';
</script>

<div class="native-demo-preview" data-tx-native-demo-preview="report-on-demand">
  <Player
    blueprint={NATIVE_DEMO_FIXTURE}
    tier="untrusted"
    status="draft"
    label="Web rendering of the validated report blueprint"
    landmarks={false}
  />
</div>

<style>
  .native-demo-preview {
    min-inline-size: 0;
    max-inline-size: 100%;
    overflow-wrap: anywhere;
  }
</style>
