<script lang="ts">
/**
 * KitApproval (kit API §11.3): a design system's (or a library entry's) approval record as
 * text: status, the declared approver and date, version, content hash and whether the hash
 * still matches. "Declared" because the kit cannot prove who approved; a reviewed commit does.
 * Labels go through `texuli.ds-kit.*` message ids (ADR-016).
 */
import { useMessages } from '../../i18n/use-messages.ts';
import type { KitApprovalView } from './approval.ts';

type Props = {
  approval: KitApprovalView;
  /** Accessible name of the record. Default: the "Approval" message. */
  label?: string;
};

let { approval, label }: Props = $props();

const msg = useMessages();
const status = $derived(
  approval.status === 'approved'
    ? msg('texuli.ds-kit.approval.approved', 'Approved')
    : approval.status === 'draft'
      ? msg('texuli.ds-kit.approval.draft', 'Draft')
      : msg('texuli.ds-kit.approval.unknown', 'Unknown status')
);
const hash = $derived(
  approval.hash === 'matches'
    ? msg('texuli.ds-kit.approval.hash-matches', 'Content hash matches the document')
    : approval.hash === 'differs'
      ? msg(
          'texuli.ds-kit.approval.hash-differs',
          'Content hash differs from the document: re-approve'
        )
      : msg('texuli.ds-kit.approval.hash-missing', 'No content hash recorded')
);
</script>

<section
  class="tx-ds-kit__approval"
  aria-label={label ?? msg('texuli.ds-kit.approval.label', 'Approval')}
  data-tx-ds-kit-approval={approval.present ? approval.status : 'none'}
>
  {#if !approval.present}
    <p>
      <span class="tx-ds-kit__badge">{msg('texuli.ds-kit.approval.none', 'Not approved')}</span>
      {msg('texuli.ds-kit.approval.no-record', 'No approval record.')}
    </p>
  {:else}
    <p>
      <span class="tx-ds-kit__badge" data-tx-ds-kit-status={approval.status}>{status}</span>
      <span data-tx-ds-kit-hash={approval.hash}>{hash}</span>
    </p>
    <dl>
      {#if approval.version}
        <dt>{msg('texuli.ds-kit.approval.version', 'Version')}</dt>
        <dd>{approval.version}</dd>
      {/if}
      {#if approval.approvedBy}
        <dt>{msg('texuli.ds-kit.approval.approver', 'Declared approver')}</dt>
        <dd>{approval.approvedBy}</dd>
      {/if}
      {#if approval.approvedAt}
        <dt>{msg('texuli.ds-kit.approval.date', 'Declared date')}</dt>
        <dd>{approval.approvedAt}</dd>
      {/if}
      {#if approval.contentHash}
        <dt>{msg('texuli.ds-kit.approval.recorded-hash', 'Recorded hash')}</dt>
        <dd><code>{approval.contentHash}</code></dd>
      {/if}
      <dt>{msg('texuli.ds-kit.approval.computed-hash', 'Computed hash')}</dt>
      <dd><code>{approval.computedHash}</code></dd>
    </dl>
  {/if}
</section>
