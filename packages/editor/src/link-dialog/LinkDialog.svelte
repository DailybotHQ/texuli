<script lang="ts">
import { isCollapsed } from '@texuli/core/editor-model';
import { untrack } from 'svelte';
import type { EditorController } from '../controller/controller.svelte.ts';
import '../editor/editor.css';

type Props = {
  controller: EditorController;
  /** Called when the dialog is done (applied, removed or cancelled); return focus to the text. */
  onClose?: () => void;
  class?: string;
};

let { controller, onClose, class: className }: Props = $props();

const uid = $props.id();
const titleId = `${uid}-link-title`;
const errorId = `${uid}-link-error`;
const labels = $derived(controller.labels);
// Read once when the dialog opens: the dialog edits the link at that selection.
const initial = untrack(() => controller.active);
const needsText = untrack(() => {
  const { selection } = controller.state;
  return selection.kind === 'text' && isCollapsed(selection) && initial.link === null;
});
let href = $state(initial.link ?? '');
let text = $state('');
let rejected = $state(false);
let input: HTMLInputElement | null = $state(null);

$effect(() => {
  input?.focus();
});

function apply(event: SubmitEvent) {
  event.preventDefault();
  if (href.trim() === '') {
    remove();
    return;
  }
  const result = controller.setLink(href.trim(), needsText ? text || href.trim() : undefined);
  if (!result.ok && result.errors.some((issue) => issue.code === 'link-rejected')) {
    rejected = true;
    input?.focus();
    return;
  }
  onClose?.();
}

function remove() {
  controller.removeLink();
  onClose?.();
}

function onkeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    event.preventDefault();
    event.stopPropagation();
    onClose?.();
  }
}
</script>

<!-- A non-modal dialog: Tab moves on normally; Escape returns to the text. -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class={['tx-editor-link-dialog', className]} role="dialog" aria-labelledby={titleId} tabindex="-1" {onkeydown}>
<form class="tx-editor-link-form" onsubmit={apply}>
  <p class="tx-editor-link-title" id={titleId}>{labels.linkDialog}</p>
  <label class="tx-editor-link-field">
    <span>{labels.linkAddress}</span>
    <input
      bind:this={input}
      bind:value={href}
      class="tx-editor-link-input"
      type="text"
      inputmode="url"
      autocomplete="off"
      spellcheck="false"
      placeholder="https://example.com"
      aria-invalid={rejected ? 'true' : undefined}
      aria-describedby={rejected ? errorId : undefined}
      oninput={() => (rejected = false)}
    />
  </label>
  {#if needsText}
    <label class="tx-editor-link-field">
      <span>{labels.linkText}</span>
      <input bind:value={text} class="tx-editor-link-input" type="text" autocomplete="off" />
    </label>
  {/if}
  {#if rejected}
    <p class="tx-editor-link-error" id={errorId}>{labels.linkRejected}</p>
  {/if}
  <div class="tx-editor-link-actions">
    <button class="tx-editor-link-button" type="submit" data-primary="">{labels.linkApply}</button>
    {#if initial.link !== null}
      <button class="tx-editor-link-button" type="button" onclick={remove}>{labels.linkRemove}</button>
    {/if}
    <button class="tx-editor-link-button" type="button" onclick={() => onClose?.()}>
      {labels.linkCancel}
    </button>
  </div>
</form>
</div>
