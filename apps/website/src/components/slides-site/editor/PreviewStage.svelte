<script lang="ts">
/**
 * The editor's preview: the real slides stage, embedded. It never claims the
 * page hash (`syncHash={false}`), fits its container, paints at the
 * `untrusted` tier and takes no focus on mount. The stage validates the deck
 * again (with its component and layout registries) and reports any refusal
 * through `onError`, so the editor can clear the preview.
 */
import '@texuli/slides/styles.css';
import '@texuli/player/styles.css';
import { DeckStage } from '@texuli/slides/stage';

interface Props {
  deck: unknown;
  onError: (
    issues: readonly {
      code: string;
      message: string;
      jsonPath: string;
      severity: 'error' | 'warning';
    }[]
  ) => void;
}

let { deck, onError }: Props = $props();
</script>

<DeckStage
  {deck}
  syncHash={false}
  fit="container"
  tier="untrusted"
  autofocus={false}
  namespace="slides-editor"
  {onError}
/>
