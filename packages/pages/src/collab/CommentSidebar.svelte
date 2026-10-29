<script lang="ts">
// Comment threads as an APG feed: each thread is an article (Page Down and
// Page Up move between them) with its quote, messages, a reply form and
// resolve, reopen, show-in-text and delete actions. A new comment opens in
// the composer at the top. Text only: bodies and mentions render as text,
// never as HTML.
import { getAnnouncer } from '@texuli/core/announcer';
import type { CollabThread } from '@texuli/document/collab';
import { tick } from 'svelte';
import { feedKeydown } from './feed.ts';
import { type CollabLabels, DEFAULT_COLLAB_LABELS } from './labels.ts';
import type { CollabSession, CommentDraft } from './session.svelte.ts';

interface Props {
  session: CollabSession;
  /** The comment being written (bindable); the composer shows while it is set. */
  draft?: CommentDraft | null;
  labels?: CollabLabels;
  /** Show a thread's text in the editor ("Show in text"). */
  onShow?: (thread: CollabThread) => void;
  /** Polite announcements. Default: `@texuli/core/announcer`. */
  announce?: (message: string) => void;
  /** Where focus goes when the composer is cancelled. */
  onCancel?: () => void;
}

let {
  session,
  draft = $bindable(null),
  labels = DEFAULT_COLLAB_LABELS,
  onShow,
  announce,
  onCancel,
}: Props = $props();

const uid = $props.id();
let feed: HTMLElement | undefined = $state();
let composer: HTMLTextAreaElement | undefined = $state();
let body = $state('');
let replies = $state<Record<string, string>>({});

const threads = $derived(session.threads);
const time = (iso: string | undefined) => {
  if (!iso) return '';
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? ''
    : new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date);
};

function say(message: string): void {
  if (announce) announce(message);
  else if (typeof document !== 'undefined') getAnnouncer(document).announce(message, 'polite');
}

// Focus the composer when a draft opens.
$effect(() => {
  if (draft) tick().then(() => composer?.focus());
});

async function focusThread(id: string): Promise<void> {
  await tick();
  feed?.querySelector<HTMLElement>(`article[data-thread="${CSS.escape(id)}"]`)?.focus();
}

function submit(event: SubmitEvent): void {
  event.preventDefault();
  if (!draft) return;
  const { quote: _quote, ...target } = draft;
  const id = session.addComment(target, body);
  if (!id) {
    say(labels.commentRefused);
    return;
  }
  body = '';
  draft = null;
  say(labels.commentAdded);
  session.activeThread = id;
  void focusThread(id);
}

function cancel(): void {
  body = '';
  draft = null;
  onCancel?.();
}

function reply(event: SubmitEvent, thread: CollabThread): void {
  event.preventDefault();
  if (!session.reply(thread.id, replies[thread.id] ?? '')) return;
  replies = { ...replies, [thread.id]: '' };
  say(labels.replied);
}

function toggle(thread: CollabThread): void {
  if (thread.status === 'open') {
    session.resolve(thread.id);
    say(labels.threadResolved);
  } else {
    session.reopen(thread.id);
    say(labels.threadReopened);
  }
  void focusThread(thread.id);
}

function remove(thread: CollabThread, index: number): void {
  session.deleteComment(thread.id);
  say(labels.threadDeleted);
  tick().then(() => {
    const articles = feed ? [...feed.querySelectorAll<HTMLElement>('article')] : [];
    (articles[Math.min(index, articles.length - 1)] ?? feed)?.focus();
  });
}
</script>

<section class="tx-pages-collab__panel" aria-labelledby={`${uid}-title`}>
  <h2 class="tx-pages-collab__heading" id={`${uid}-title`}>{labels.comments}</h2>
  {#if draft}
    <form class="tx-pages-collab__composer" onsubmit={submit}>
      <label class="tx-pages-collab__label" for={`${uid}-body`}>
        {draft.quote ? labels.newComment(draft.quote) : labels.newBlockComment}
      </label>
      <textarea
        id={`${uid}-body`}
        class="tx-pages-collab__input"
        rows="3"
        maxlength="4000"
        bind:this={composer}
        bind:value={body}
        onkeydown={(event) => {
          if (event.key === 'Escape') {
            event.preventDefault();
            cancel();
          }
        }}
      ></textarea>
      <div class="tx-pages-collab__buttons">
        <button type="submit" class="tx-pages-action">{labels.submitComment}</button>
        <button type="button" class="tx-pages-action" onclick={cancel}>{labels.cancel}</button>
      </div>
    </form>
  {/if}
  {#if threads.length === 0}
    <p class="tx-pages-collab__empty">{labels.noComments}</p>
  {:else}
    <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
    <div
      class="tx-pages-collab__feed"
      role="feed"
      aria-busy="false"
      aria-labelledby={`${uid}-title`}
      bind:this={feed}
      onkeydown={(event) => feed && feedKeydown(event, feed)}
    >
      {#each threads as thread, index (thread.id)}
        <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
        <article
          class="tx-pages-collab__thread"
          tabindex="0"
          aria-posinset={index + 1}
          aria-setsize={threads.length}
          aria-labelledby={`${uid}-${index}-name`}
          aria-describedby={`${uid}-${index}-quote`}
          data-thread={thread.id}
          data-status={thread.status}
          data-orphaned={thread.orphaned ? '' : undefined}
          data-active={session.activeThread === thread.id ? '' : undefined}
          onfocusin={() => (session.activeThread = thread.id)}
        >
          <h3 class="tx-pages-collab__thread-name" id={`${uid}-${index}-name`}>
            {labels.threadName(thread.author, thread.quote)}
            {#if thread.status === 'resolved'}<span class="tx-pages-collab__badge">{labels.resolved}</span>{/if}
          </h3>
          <p class="tx-pages-collab__quote" id={`${uid}-${index}-quote`}>
            {#if thread.orphaned}{labels.detached} {/if}{#if thread.quote}<q>{thread.quote}</q>{/if}
          </p>
          <ol class="tx-pages-collab__messages">
            {#each thread.messages as message (message.id)}
              <li class="tx-pages-collab__message">
                <span class="tx-pages-collab__author">{message.author}</span>
                {#if message.created}<time class="tx-pages-collab__time" datetime={message.created}>{time(message.created)}</time>{/if}
                <p class="tx-pages-collab__text">{#each message.segments as segment, i (i)}{#if 'mention' in segment}<span class="tx-pages-collab__mention" data-mention={segment.mention.id}>@{segment.mention.label}</span>{:else}{segment.text}{/if}{/each}</p>
              </li>
            {/each}
          </ol>
          <form class="tx-pages-collab__reply" onsubmit={(event) => reply(event, thread)}>
            <label class="tx-pages-visually-hidden" for={`${uid}-${index}-reply`}>{labels.replyLabel(thread.author)}</label>
            <textarea
              id={`${uid}-${index}-reply`}
              class="tx-pages-collab__input"
              rows="1"
              maxlength="4000"
              placeholder={labels.reply}
              value={replies[thread.id] ?? ''}
              oninput={(event) => (replies = { ...replies, [thread.id]: (event.currentTarget as HTMLTextAreaElement).value })}
            ></textarea>
            <button type="submit" class="tx-pages-action">{labels.reply}</button>
          </form>
          <div class="tx-pages-collab__buttons">
            <button type="button" class="tx-pages-action" onclick={() => toggle(thread)}>
              {thread.status === 'open' ? labels.resolve : labels.reopen}
            </button>
            {#if !thread.orphaned && onShow}
              <button type="button" class="tx-pages-action" onclick={() => onShow?.(thread)}>{labels.showInText}</button>
            {/if}
            <button type="button" class="tx-pages-action" onclick={() => remove(thread, index)}>{labels.deleteThread}</button>
          </div>
        </article>
      {/each}
    </div>
  {/if}
</section>
