<script lang="ts">
/**
 * Export for chat (PLAN_023 row 11): the document written for Slack, Discord, WhatsApp,
 * Telegram, Teams, Google Chat, Mattermost or plain text by `documentToDialect`, shown as
 * read-only text with what the format loses listed for the user. Broadcast mentions are never
 * written. Copy uses the async Clipboard API, or the host's `onCopy`.
 */
import type { EditorDocument } from '@texuli/core/editor-model';
import type { HrefTrust } from '@texuli/core/url-policy';
import { Button } from 'texuli/button';
import { Select } from 'texuli/select';
import type { EditorController } from '../controller/controller.svelte.ts';
import {
  documentToDialect,
  EDITOR_DIALECT_NAMES,
  EDITOR_EXPORT_DIALECTS,
  type MarkdownDialect,
} from '../markdown/index.ts';
import '../editor/editor.css';
import './export.css';

type Props = {
  /** The editor whose document is exported (its labels are used too). */
  controller?: EditorController;
  /** A document to export instead of a controller's. */
  doc?: EditorDocument;
  /** The chosen format (bindable). Default `slack`. */
  dialect?: MarkdownDialect;
  /** The formats offered, in order. Default every format. */
  dialects?: readonly MarkdownDialect[];
  /** Visible format names (translate or rename). */
  names?: Partial<Record<MarkdownDialect, string>>;
  /** URL policy tier links are checked at again. Default `untrusted`. */
  trust?: HrefTrust;
  /** Replaces the Clipboard API: return or resolve `false` when copying failed. */
  onCopy?: (text: string, dialect: MarkdownDialect) => boolean | Promise<boolean>;
  class?: string;
};

let {
  controller,
  doc,
  dialect = $bindable('slack'),
  dialects = EDITOR_EXPORT_DIALECTS,
  names,
  trust = 'untrusted',
  onCopy,
  class: className,
}: Props = $props();

const uid = $props.id();
const labels = $derived(controller?.labels);
const nameOf = (value: MarkdownDialect) => names?.[value] ?? EDITOR_DIALECT_NAMES[value];
const items = $derived(dialects.map((value) => ({ value, label: nameOf(value) })));
const source = $derived(doc ?? controller?.doc ?? { version: 1 as const, blocks: [] });
const result = $derived(documentToDialect(source, dialect, { trust }));
const lossCount = $derived(result.losses.reduce((sum, loss) => sum + loss.count, 0));
let copyState = $state<'idle' | 'copied' | 'failed'>('idle');

const text = $derived({
  title: labels?.exportTitle ?? 'Export for chat',
  format: labels?.exportFormat ?? 'Format',
  output: labels?.exportOutput(nameOf(dialect)) ?? `${nameOf(dialect)} text`,
  copy: labels?.exportCopy ?? 'Copy',
  copied: labels?.exportCopied ?? 'Copied',
  failed: labels?.exportCopyFailed ?? 'Copy failed: select the text and copy it.',
  losses: labels?.exportLosses(lossCount) ?? `${lossCount} changes in this format`,
  none: labels?.exportNoLosses ?? 'Nothing changes in this format.',
});

async function copy() {
  let ok = false;
  try {
    if (onCopy) ok = await onCopy(result.value, dialect);
    else if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(result.value);
      ok = true;
    }
  } catch {
    ok = false;
  }
  copyState = ok ? 'copied' : 'failed';
}

$effect(() => {
  // A new format or document resets the copy status.
  void result;
  copyState = 'idle';
});
</script>

<section class={['tx-editor-export', className]} aria-labelledby="{uid}-title" data-editor-export>
  <!-- Not a heading: the panel lands at any heading level, and a fixed one breaks the order. -->
  <p class="tx-editor-export__title" id="{uid}-title">{text.title}</p>
  <div class="tx-editor-export__controls">
    <span class="tx-editor-export__label" id="{uid}-format">{text.format}</span>
    <Select.Root bind:value={dialect} {items} name="{uid}-dialect">
      <Select.Trigger aria-labelledby="{uid}-format" data-editor-export-format>
        <Select.Value />
      </Select.Trigger>
      <Select.Portal>
        <Select.Content>
          <Select.Viewport>
            {#each items as item (item.value)}
              <Select.Item value={item.value} label={item.label}>{item.label}</Select.Item>
            {/each}
          </Select.Viewport>
        </Select.Content>
      </Select.Portal>
    </Select.Root>
    <Button size="sm" variant="outline" onclick={copy} data-editor-export-copy>{text.copy}</Button>
    <span class="tx-editor-export__status" role="status">
      {copyState === 'copied' ? text.copied : copyState === 'failed' ? text.failed : ''}
    </span>
  </div>
  <label class="tx-editor-export__label" for="{uid}-output">{text.output}</label>
  <textarea
    class="tx-editor-export__output"
    id="{uid}-output"
    readonly
    rows="8"
    spellcheck="false"
    data-editor-export-output
    data-dialect={dialect}
    value={result.value}
  ></textarea>
  <div class="tx-editor-export__losses" aria-live="polite" data-editor-export-losses>
    {#if result.losses.length === 0}
      <p>{text.none}</p>
    {:else}
      <p class="tx-editor-export__losses-title">{text.losses}</p>
      <ul>
        {#each result.losses as loss (loss.code + loss.message)}
          <li data-loss-code={loss.code}>
            {loss.count > 1 ? `${loss.message} (×${loss.count})` : loss.message}
          </li>
        {/each}
      </ul>
    {/if}
  </div>
</section>
