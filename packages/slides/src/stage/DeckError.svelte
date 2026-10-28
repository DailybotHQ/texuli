<script lang="ts">
/**
 * The visible, accessible state for a deck that did not validate. The stage
 * never paints an invalid deck: it shows what is wrong instead (plain text
 * diagnostics, at most `limit` listed), and the host gets the full list from
 * `onError` and the `tx-deck:error` event.
 */
import type { DeckDiagnostic } from '@texuli/deck/schema';
import type { DeckTranslate } from './messages.ts';

interface Props {
  issues: readonly DeckDiagnostic[];
  t: DeckTranslate;
  limit?: number;
}

let { issues, t, limit = 8 }: Props = $props();
let errors = $derived(issues.filter((issue) => issue.severity === 'error'));
let shown = $derived(errors.slice(0, limit));
</script>

<div class="tx-deck-stage__invalid" data-tx-deck-invalid>
  <p class="tx-deck-stage__invalid-title" role="alert">{t('stage.invalidTitle')}</p>
  <p class="tx-deck-stage__invalid-summary">{t('stage.invalidSummary', { count: errors.length })}</p>
  <ul class="tx-deck-stage__invalid-list">
    {#each shown as issue, index (`${issue.jsonPath}:${issue.code}:${index}`)}
      <li data-code={issue.code}>
        <code class="tx-deck-stage__invalid-path">{issue.jsonPath}</code>
        <span>{issue.message}</span>
      </li>
    {/each}
  </ul>
  {#if errors.length > shown.length}
    <p class="tx-deck-stage__invalid-more">{t('stage.invalidMore', { count: errors.length - shown.length })}</p>
  {/if}
</div>
