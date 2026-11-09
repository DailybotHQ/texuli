<script lang="ts">
/**
 * KitChanges (kit API §5.4, owner answer 6): what changed between the previous and the
 * current version — tokens (from the compiled outputs), the allow set, the library and the
 * approval — as a grouped list, version A → version B, each change as text with its kind. It
 * is what a consumer shows before moving a pinned version. Every group has a stable `id` for
 * deep links. No raw HTML, no network.
 */
import { useMessages } from '../../i18n/use-messages.ts';
import { kitItemId, kitPrefix, kitSectionId } from '../shared/navigation.ts';
import type { KitCompiled } from '../shared/types.ts';
import '../shared/ds-kit.css';
import './library.css';
import { changesModel, type KitChangeKind } from './changes-model.ts';

type Props = {
  /** The version to compare against. */
  previous: { document: unknown; compiled?: KitCompiled };
  /** The current version. */
  document: unknown;
  compiled?: KitCompiled;
  /** Heading level of the section title (groups use the next level). Default 3. */
  headingLevel?: 2 | 3 | 4;
  /** Prefix of every `id` (deep links). Default `tx-ds-kit`. */
  idPrefix?: string;
  /** The current item (`tokens`, `allow`, `library` or `approval`): its group gets `aria-current`. */
  currentItem?: string;
};

let {
  previous,
  document: doc,
  compiled,
  headingLevel = 3,
  idPrefix,
  currentItem,
}: Props = $props();

const model = $derived(changesModel(previous, { document: doc, compiled }));
const prefix = $derived(kitPrefix(idPrefix));
const sid = $derived(kitSectionId(prefix, 'changes'));
const h = $derived(`h${headingLevel}`);
const h2 = $derived(`h${Math.min(headingLevel + 1, 6)}`);
const msg = useMessages();
const none = $derived(msg('texuli.ds-kit.changes.none', 'No changes.'));
const kindLabel = (kind: KitChangeKind) =>
  kind === 'added'
    ? msg('texuli.ds-kit.changes.added', 'Added')
    : kind === 'removed'
      ? msg('texuli.ds-kit.changes.removed', 'Removed')
      : msg('texuli.ds-kit.changes.changed', 'Changed');
const list = (values: readonly string[] | undefined) =>
  values === undefined
    ? msg('texuli.ds-kit.changes.every-value', 'every catalog value')
    : values.length === 0
      ? msg('texuli.ds-kit.changes.no-value', 'none')
      : values.join(', ');
const groups = ['tokens', 'allow', 'library', 'approval'] as const;
const groupLabel = (id: (typeof groups)[number]) =>
  id === 'tokens'
    ? msg('texuli.ds-kit.changes.tokens', 'Tokens')
    : id === 'allow'
      ? msg('texuli.ds-kit.changes.allow', 'Allowed components')
      : id === 'library'
        ? msg('texuli.ds-kit.changes.library', 'Library entries')
        : msg('texuli.ds-kit.changes.approval', 'Approval');
</script>

<section
  class="tx-ds-kit__section tx-ds-kit-changes"
  id={sid}
  aria-labelledby={`${sid}-title`}
  data-tx-ds-kit-section="changes"
>
  <svelte:element this={h} id={`${sid}-title`} class="tx-ds-kit__title">
    {msg('texuli.ds-kit.section.changes', 'Changes')}
  </svelte:element>
  <p data-tx-ds-kit-versions="">
    {msg('texuli.ds-kit.changes.versions', 'From {0} to {1}', {
      0: model.from ?? '?',
      1: model.to ?? '?',
    })}
    {#if model.identical}<span class="tx-ds-kit__muted"> · {none}</span>{/if}
  </p>

  {#each groups as group (group)}
    {@const gid = kitItemId(prefix, 'changes', group)}
    <section
      class="tx-ds-kit__group"
      id={gid}
      aria-labelledby={`${gid}-title`}
      aria-current={currentItem === group ? 'true' : undefined}
      data-tx-ds-kit-changes={group}
    >
      <svelte:element this={h2} id={`${gid}-title`} class="tx-ds-kit__subtitle">{groupLabel(group)}</svelte:element>
      {#if group === 'tokens'}
        {#if !model.tokens}
          <p class="tx-ds-kit__note">
            {msg('texuli.ds-kit.changes.compile-both', 'Compile both versions to compare tokens.')}
          </p>
        {:else if model.tokens.identical}
          <p class="tx-ds-kit__note">{none}</p>
        {:else}
          <ul>
            {#each model.tokens.tokens.slice(0, 100) as change, i (i)}
              <li data-tx-ds-kit-change={change.change}>
                {kindLabel(change.change)} · {change.mode} · <code>{change.variable}</code>
                {#if change.before}: <code>{change.before}</code>{/if}
                {#if change.after} → <code>{change.after}</code>{/if}
              </li>
            {/each}
            {#each model.tokens.contrast.slice(0, 100) as regression, i (i)}
              <li data-tx-ds-kit-change="regression">
                {msg('texuli.ds-kit.changes.regression', 'Contrast regression')} · {regression.mode} ·
                <code>{regression.foreground}</code> / <code>{regression.background}</code>
              </li>
            {/each}
            {#each model.tokens.defaults.slice(0, 100) as change, i (i)}
              <li data-tx-ds-kit-change="defaults">
                {msg('texuli.ds-kit.changes.default', 'Default')} · <code>{change.component}</code>
              </li>
            {/each}
            {#each model.tokens.attrs.slice(0, 100) as change, i (i)}
              <li data-tx-ds-kit-change="attribute">
                {msg('texuli.ds-kit.changes.attribute', 'Attribute')} · <code>{change.attribute}</code>
              </li>
            {/each}
          </ul>
        {/if}
      {:else if group === 'allow'}
        {#if model.allow.length === 0}
          <p class="tx-ds-kit__note">{none}</p>
        {:else}
          <ul>
            {#each model.allow as change, i (i)}
              <li data-tx-ds-kit-change={change.kind}>
                {#if change.kind === 'locked'}
                  {msg('texuli.ds-kit.changes.locked', 'Locked to an allow set')}
                {:else if change.kind === 'unlocked'}
                  {msg('texuli.ds-kit.changes.unlocked', 'Unlocked: every catalog component allowed')}
                {:else if change.kind === 'changed'}
                  {kindLabel('changed')} · <code>{change.component}</code> · {change.list}:
                  {list(change.before)} → {list(change.after)}
                {:else if change.kind === 'added' || change.kind === 'removed'}
                  {kindLabel(change.kind)} · <code>{change.component}</code>
                {/if}
              </li>
            {/each}
          </ul>
        {/if}
      {:else if group === 'library'}
        {#if model.library.length === 0}
          <p class="tx-ds-kit__note">{none}</p>
        {:else}
          <ul>
            {#each model.library as change (change.id)}
              <li data-tx-ds-kit-change={change.kind}>
                {kindLabel(change.kind)} · <code>{change.id}</code>
                {#each change.fields ?? [] as field (field.field)}
                  · {field.field}: {field.before ?? '—'} → {field.after ?? '—'}
                {/each}
              </li>
            {/each}
          </ul>
        {/if}
      {:else}
        {#if model.approval.length === 0}
          <p class="tx-ds-kit__note">{none}</p>
        {:else}
          <ul>
            {#each model.approval as change (change.field)}
              <li data-tx-ds-kit-change="approval">
                {change.field}: {change.before ?? '—'} → {change.after ?? '—'}
              </li>
            {/each}
          </ul>
        {/if}
        {#if model.contentChanged}
          <p class="tx-ds-kit__note" data-tx-ds-kit-content-changed="">
            {msg('texuli.ds-kit.changes.content-changed', 'The content changed: an approval of the previous version does not cover this one.')}
          </p>
        {/if}
      {/if}
    </section>
  {/each}
</section>
