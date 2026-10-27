<script lang="ts">
/**
 * The paint half of the JSON live preview: the real `<Player>` at the
 * `untrusted` tier, refusing invalid drafts (the default policy). The
 * island mounts this only for a blueprint its own check accepted; the
 * player validates again and reports what it found.
 */
import {
  PLAYER_LOADERS,
  Player,
  type PlayerDiagnosticsEvent,
  type PlayerNodeError,
} from '@texuli/player';
import { PREVIEW_TIER } from './validate.ts';

let {
  blueprint,
  onDiagnostics,
  onNodeError,
}: {
  blueprint: unknown;
  onDiagnostics: (event: PlayerDiagnosticsEvent) => void;
  onNodeError: (error: PlayerNodeError) => void;
} = $props();
</script>

<Player
  {blueprint}
  tier={PREVIEW_TIER}
  status="draft"
  invalidPolicy="refuse"
  label="JSON live preview (untrusted)"
  landmarks={false}
  loaders={PLAYER_LOADERS}
  loadTimeoutMs={8000}
  {onDiagnostics}
  {onNodeError}
/>
