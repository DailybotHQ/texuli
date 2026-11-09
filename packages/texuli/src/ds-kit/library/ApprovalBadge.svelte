<script lang="ts">
/**
 * ApprovalBadge (kit API §5.3): one approval record as a compact badge — `Draft`, `Approved`
 * or `Not approved` — with the declared approver and date and the content-hash check, all as
 * text (never color alone). "Declared" because the kit cannot prove who approved; a reviewed
 * commit does (ADR-032). Labels go through `texuli.ds-kit.*` message ids (ADR-016).
 */
import { useMessages } from '../../i18n/use-messages.ts';
import type { KitApprovalView } from '../shared/approval.ts';

type Props = { approval: KitApprovalView };

let { approval }: Props = $props();

const msg = useMessages();
const status = $derived(
  !approval.present
    ? msg('texuli.ds-kit.approval.none', 'Not approved')
    : approval.status === 'approved'
      ? msg('texuli.ds-kit.approval.approved', 'Approved')
      : approval.status === 'draft'
        ? msg('texuli.ds-kit.approval.draft', 'Draft')
        : msg('texuli.ds-kit.approval.unknown', 'Unknown status')
);
const declared = $derived(
  approval.approvedBy && approval.approvedAt
    ? msg('texuli.ds-kit.library.declared-by-on', 'declared by {0} on {1}', {
        0: approval.approvedBy,
        1: approval.approvedAt,
      })
    : approval.approvedBy
      ? msg('texuli.ds-kit.library.declared-by', 'declared by {0}', { 0: approval.approvedBy })
      : undefined
);
const hash = $derived(
  approval.hash === 'matches'
    ? msg('texuli.ds-kit.library.hash-matches', 'Hash matches')
    : approval.hash === 'differs'
      ? msg('texuli.ds-kit.library.hash-differs', 'Hash differs: re-approve')
      : undefined
);
</script>

<p
  class="tx-ds-kit__approval-badge"
  data-tx-ds-kit-approval={approval.present ? approval.status : 'none'}
>
  <span class="tx-ds-kit__badge" data-tx-ds-kit-status={approval.present ? approval.status : 'none'}>{status}</span>
  {#if declared}<span class="tx-ds-kit__muted">{declared}</span>{/if}
  {#if hash}<span data-tx-ds-kit-hash={approval.hash}>{hash}</span>{/if}
</p>
