<script lang="ts">
/**
 * The sample scenario: a small modal dialog on the native `<dialog>`
 * element. It exists to prove the harness, not as a Texuli component.
 * `broken` drops focus restoration and leaves scroll locked, so the self
 * test can show the harness catching both.
 */
import { behaviorEvent } from '../client/events.ts';

let { broken = false }: { broken?: boolean } = $props();

let dialog: HTMLDialogElement | undefined = $state();
let trigger: HTMLButtonElement | undefined = $state();
let open = $state(false);
let restoreOverflow = '';

function show(): void {
  if (!dialog || open) return;
  open = true;
  behaviorEvent('openChange', true);
  const root = document.documentElement;
  restoreOverflow = root.style.getPropertyValue('overflow');
  root.style.setProperty('overflow', 'hidden');
  dialog.showModal();
  dialog.querySelector<HTMLElement>('input')?.focus();
}

function hide(): void {
  if (!dialog || !open) return;
  open = false;
  dialog.close();
  behaviorEvent('openChange', false);
  if (broken) {
    (document.activeElement as HTMLElement | null)?.blur();
    return;
  }
  const root = document.documentElement;
  if (restoreOverflow) root.style.setProperty('overflow', restoreOverflow);
  else root.style.removeProperty('overflow');
  trigger?.focus();
}

/**
 * Keeps Tab inside the dialog by moving focus itself on every Tab: a modal
 * `<dialog>` alone lets focus reach the browser, and WebKit's Tab skips
 * buttons unless the page moves focus.
 */
function trap(event: KeyboardEvent): void {
  if (event.key !== 'Tab' || !dialog) return;
  const focusable = [...dialog.querySelectorAll<HTMLElement>('input, button')];
  if (focusable.length === 0) return;
  event.preventDefault();
  const at = focusable.indexOf(document.activeElement as HTMLElement);
  const step = event.shiftKey ? -1 : 1;
  const next = at < 0 ? (event.shiftKey ? focusable.length - 1 : 0) : at + step;
  focusable[(next + focusable.length) % focusable.length]?.focus();
}
</script>

<button type="button" bind:this={trigger} aria-haspopup="dialog" onclick={show}>Open settings</button>
<dialog
  bind:this={dialog}
  class="sample-dialog"
  aria-labelledby="sample-title"
  aria-describedby="sample-description"
  oncancel={(event) => {
    event.preventDefault();
    hide();
  }}
  onclick={(event) => {
    // A click on the backdrop lands on the dialog element itself.
    if (event.target === dialog) hide();
  }}
  onkeydown={trap}
>
  <div class="sample-body">
    <h2 id="sample-title">Settings</h2>
    <p id="sample-description">Change how your fictional workspace looks.</p>
    <label>
      Display name
      <input name="display-name" value="Ada Example" />
    </label>
    <button type="button">Save</button>
    <button type="button" onclick={hide}>Close</button>
  </div>
</dialog>

<style>
  .sample-dialog {
    padding: 0;
    border: 0;
  }
  .sample-dialog::backdrop {
    background: rgb(0 0 0 / 0.4);
  }
  .sample-body {
    display: grid;
    gap: 0.75rem;
    padding: 1.5rem;
  }
</style>
