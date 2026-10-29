<script lang="ts">
// The page editor on a collaboration session: the editor's op log stays the
// only edit path (local transactions go to the replica, merged changes come
// back as `sync` entries), with a review bar (comment, suggesting, version
// history), the collaborator list, highlights and remote carets over the
// text (aria-hidden), and a sidebar with the comment and suggestion feeds
// and the version history.
import { getAnnouncer } from '@texuli/core/announcer';
import type { CollabThread } from '@texuli/document/collab';
import { findNode, inlinePlainText } from '@texuli/document/model';
import { readDomSelection } from '@texuli/editor/editor';
import type { DeckPlayerHost } from '@texuli/player';
import { untrack } from 'svelte';
import type { MotionProp } from 'texuli/motion';
import PageEditor from '../editor/PageEditor.svelte';
import type { ComponentEmbedOption } from '../editor/slash.ts';
import type { PagesEditor } from '../editor/state.svelte.ts';
import type { EmbedResolver } from '../shared/embeds.ts';
import type { PagesLabels } from '../shared/labels.ts';
import type { MediaResolver } from '../shared/media.ts';
import type { PageRef } from '../shared/types.ts';
import CollabOverlay from './CollabOverlay.svelte';
import CollaboratorList from './CollaboratorList.svelte';
import CommentSidebar from './CommentSidebar.svelte';
import { type CollabLabels, resolveCollabLabels } from './labels.ts';
import SuggestionList from './SuggestionList.svelte';
import type { CollabSession, CommentDraft } from './session.svelte.ts';
import VersionHistory from './VersionHistory.svelte';
import './collab.css';

interface Props {
  /** The collaboration session (`createCollabSession`). */
  session: CollabSession;
  /** The editor region's accessible name. Default: the document title. */
  label?: string;
  /** Page editor strings. */
  labels?: Partial<PagesLabels>;
  /** Collaboration strings. */
  collabLabels?: Partial<CollabLabels>;
  readonly?: boolean;
  /** Ancestor pages, outermost first. */
  trail?: readonly PageRef[];
  onNavigate?: (ref: string) => void;
  pageHref?: (ref: string) => string | null | undefined;
  createPage?: () => PageRef | null | undefined | Promise<PageRef | null | undefined>;
  resolveEmbed?: EmbedResolver;
  resolveMedia?: MediaResolver;
  deckHost?: DeckPlayerHost | null;
  components?: readonly ComponentEmbedOption[];
  motion?: MotionProp;
  /** The page editor state (bindable). */
  editor?: PagesEditor;
  /** Show the version history panel (bindable). */
  history?: boolean;
  /** Polite announcements. Default: `@texuli/core/announcer`. */
  announce?: (message: string) => void;
  class?: string;
}

let {
  session,
  label,
  labels,
  collabLabels,
  readonly = false,
  trail = [],
  onNavigate,
  pageHref,
  createPage,
  resolveEmbed,
  resolveMedia,
  deckHost = null,
  components,
  motion,
  editor = $bindable(),
  history = $bindable(false),
  announce,
  class: className,
}: Props = $props();

const uid = $props.id();
const strings = $derived(resolveCollabLabels(collabLabels));
const initial = untrack(() => session.document);
let docRoot: HTMLDivElement | undefined = $state();
let commentButton: HTMLButtonElement | undefined = $state();
let draft = $state<CommentDraft | null>(null);
let last: { block: string; anchor: number; focus: number; focusBlock: string } | null = null;

function say(message: string): void {
  if (announce) announce(message);
  else if (typeof document !== 'undefined') getAnnouncer(document).announce(message, 'polite');
}

// Put the editor on the session (its op log stays the single edit path).
$effect(() => {
  const current = editor;
  if (!current) return;
  return untrack(() => session.bind(current));
});

// Track this author's selection: presence for peers and the comment target.
$effect(() => {
  const root = docRoot;
  if (!root) return;
  let frame = 0;
  const read = () => {
    const selection = readDomSelection(root, root.ownerDocument.getSelection());
    if (selection?.kind !== 'text') return;
    const { anchor, focus } = selection;
    last = {
      block: anchor.block,
      anchor: anchor.offset,
      focus: focus.offset,
      focusBlock: focus.block,
    };
    session.setSelection({
      focus: { block: focus.block, offset: focus.offset },
      anchor: { block: anchor.block, offset: anchor.offset },
    });
  };
  const onchange = () => {
    if (typeof requestAnimationFrame !== 'function') return read();
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(read);
  };
  root.ownerDocument.addEventListener('selectionchange', onchange);
  return () => {
    root.ownerDocument.removeEventListener('selectionchange', onchange);
    if (typeof cancelAnimationFrame === 'function') cancelAnimationFrame(frame);
  };
});

function openComment(): void {
  const at = last;
  if (!at || !findNode(session.document, at.focusBlock)) {
    say(strings.selectText);
    return;
  }
  if (at.block === at.focusBlock && at.anchor !== at.focus) {
    const from = Math.min(at.anchor, at.focus);
    const to = Math.max(at.anchor, at.focus);
    const node = findNode(session.document, at.block)?.node as
      | { content?: never[]; text?: string }
      | undefined;
    const text = node?.content ? inlinePlainText(node.content) : (node?.text ?? '');
    draft = { block: at.block, from, to, quote: text.slice(from, to) };
  } else draft = { block: at.focusBlock, quote: '' };
}

function onkeydown(event: KeyboardEvent): void {
  if ((event.ctrlKey || event.metaKey) && event.altKey && event.code === 'KeyM') {
    event.preventDefault();
    if (!readonly) openComment();
  }
}

function toggleSuggesting(): void {
  session.suggesting = !session.suggesting;
  say(session.suggesting ? strings.suggestingOn : strings.suggestingOff);
}

function show(thread: CollabThread): void {
  const pages = editor;
  if (!pages || !thread.range) return;
  session.activeThread = thread.id;
  const row = pages.rowOf(thread.block);
  if (row) pages.requestFocus(row, { leaf: thread.block, offset: thread.range.from });
}

/** Keys the document area handles around the editor (an attachment: the wrapper is not interactive). */
function keys(node: HTMLElement): () => void {
  node.addEventListener('keydown', onkeydown);
  return () => node.removeEventListener('keydown', onkeydown);
}
</script>

<div class={['tx-pages-collab', className]} data-suggesting={session.suggesting ? '' : undefined}>
  <div class="tx-pages-collab__bar">
    {#if !readonly}
      <div class="tx-pages-collab__tools" role="group" aria-label={strings.toolbar}>
        <button
          type="button"
          class="tx-pages-action"
          aria-keyshortcuts={strings.commentShortcut}
          bind:this={commentButton}
          onclick={openComment}
        >{strings.comment}</button>
        <button type="button" class="tx-pages-action" aria-pressed={session.suggesting} onclick={toggleSuggesting}>{strings.suggesting}</button>
        <button
          type="button"
          class="tx-pages-action"
          aria-expanded={history}
          aria-controls={`${uid}-history`}
          onclick={() => (history = !history)}
        >{strings.history}</button>
      </div>
    {/if}
    <CollaboratorList {session} labels={strings} />
  </div>
  <div class="tx-pages-collab__body">
    <div class="tx-pages-collab__doc" bind:this={docRoot} {@attach keys}>
      <PageEditor
        document={initial}
        bind:editor
        {label}
        {labels}
        {readonly}
        {trail}
        {onNavigate}
        {pageHref}
        {createPage}
        {resolveEmbed}
        {resolveMedia}
        {deckHost}
        {components}
        {motion}
        {announce}
      />
      <CollabOverlay {session} root={docRoot} />
    </div>
    <aside class="tx-pages-collab__sidebar" aria-label={strings.region}>
      <CommentSidebar
        {session}
        bind:draft
        labels={strings}
        onShow={show}
        {announce}
        onCancel={() => commentButton?.focus()}
      />
      <SuggestionList {session} labels={strings} {announce} />
      <div id={`${uid}-history`} class="tx-pages-collab__history" hidden={!history}>
        {#if history}<VersionHistory {session} labels={strings} {announce} />{/if}
      </div>
    </aside>
  </div>
</div>
