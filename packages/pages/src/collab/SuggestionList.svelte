<script lang="ts">
// Pending suggestions as an APG feed: each suggestion is an article with
// its author and changes (insert or delete, as text) and Accept and Reject
// buttons; Accept all and Reject all settle every pending one. Accepting
// and rejecting are ordinary synced operations that undo as one step.
import { getAnnouncer } from '@texuli/core/announcer';
import { tick } from 'svelte';
import { feedKeydown } from './feed.ts';
import { type CollabLabels, DEFAULT_COLLAB_LABELS } from './labels.ts';
import type { CollabSession } from './session.svelte.ts';

interface Props {
  session: CollabSession;
  labels?: CollabLabels;
  /** Polite announcements. Default: `@texuli/core/announcer`. */
  announce?: (message: string) => void;
}

let { session, labels = DEFAULT_COLLAB_LABELS, announce }: Props = $props();

const uid = $props.id();
let feed: HTMLElement | undefined = $state();
const suggestions = $derived(session.suggestions);

function say(message: string): void {
  if (announce) announce(message);
  else if (typeof document !== 'undefined') getAnnouncer(document).announce(message, 'polite');
}

function settle(id: string, accept: boolean, index: number): void {
  if (accept) session.accept(id);
  else session.reject(id);
  say(accept ? labels.suggestionAccepted : labels.suggestionRejected);
  tick().then(() => {
    const articles = feed ? [...feed.querySelectorAll<HTMLElement>('article')] : [];
    articles[Math.min(index, articles.length - 1)]?.focus();
  });
}

function settleAll(accept: boolean): void {
  if (accept) session.acceptAll();
  else session.rejectAll();
  say(accept ? labels.suggestionAccepted : labels.suggestionRejected);
}
</script>

<section class="tx-pages-collab__panel" aria-labelledby={`${uid}-title`}>
  <h2 class="tx-pages-collab__heading" id={`${uid}-title`}>{labels.suggestions}</h2>
  {#if suggestions.length === 0}
    <p class="tx-pages-collab__empty">{labels.noSuggestions}</p>
  {:else}
    <div class="tx-pages-collab__buttons">
      <button type="button" class="tx-pages-action" onclick={() => settleAll(true)}>{labels.acceptAll}</button>
      <button type="button" class="tx-pages-action" onclick={() => settleAll(false)}>{labels.rejectAll}</button>
    </div>
    <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
    <div
      class="tx-pages-collab__feed"
      role="feed"
      aria-busy="false"
      aria-labelledby={`${uid}-title`}
      bind:this={feed}
      onkeydown={(event) => feed && feedKeydown(event, feed)}
    >
      {#each suggestions as suggestion, index (suggestion.id)}
        <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
        <article
          class="tx-pages-collab__suggestion"
          tabindex="0"
          aria-posinset={index + 1}
          aria-setsize={suggestions.length}
          aria-labelledby={`${uid}-${index}-name`}
          aria-describedby={`${uid}-${index}-changes`}
          data-suggestion={suggestion.id}
        >
          <h3 class="tx-pages-collab__thread-name" id={`${uid}-${index}-name`}>{labels.suggestionName(suggestion.author)}</h3>
          <ul class="tx-pages-collab__changes" id={`${uid}-${index}-changes`}>
            {#each suggestion.changes as change, i (i)}
              <li class="tx-pages-collab__change" data-kind={change.kind}>
                {change.kind === 'insert' ? labels.inserted(change.text) : labels.deleted(change.text)}
              </li>
            {/each}
          </ul>
          <div class="tx-pages-collab__buttons">
            <button type="button" class="tx-pages-action" onclick={() => settle(suggestion.id, true, index)}>{labels.accept}</button>
            <button type="button" class="tx-pages-action" onclick={() => settle(suggestion.id, false, index)}>{labels.reject}</button>
          </div>
        </article>
      {/each}
    </div>
  {/if}
</section>
