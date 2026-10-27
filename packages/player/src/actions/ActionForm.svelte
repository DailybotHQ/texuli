<script lang="ts">
import type { Snippet } from 'svelte';
import { type ActionStatus, actionValues, validateFieldValue } from '../actions.ts';
import {
  getPlayerActionAccess,
  getPlayerInteraction,
  getPlayerLabels,
  getPlayerStateAccess,
} from '../context.ts';
import { type RegisteredField, setActionFormContext } from './form-context.ts';

let {
  action,
  label,
  children,
  txPath,
}: { action: string; label: string; children?: Snippet; txPath?: string } = $props();
const interaction = getPlayerInteraction();
let form = $state<HTMLFormElement>();
const actions = getPlayerActionAccess();
const stateAccess = getPlayerStateAccess();
const labels = getPlayerLabels();
const receiptId = $props.id();

const fields = new Set<RegisteredField>();
let status = $state<ActionStatus | null>(null);

setActionFormContext({
  register(field) {
    fields.add(field);
    return () => fields.delete(field);
  },
  pending: () => status === 'pending',
  submit: () => form?.requestSubmit(),
});

let receipt = $derived.by(() => {
  const text = labels();
  switch (status) {
    case 'pending':
      return text.actionPending;
    case 'confirmed':
      return text.actionConfirmed;
    case 'rejected':
      return text.actionRejected;
    case 'failed':
      return text.actionFailed;
    case 'unavailable':
      return text.actionUnavailable;
    default:
      return '';
  }
});

async function onSubmit(event: SubmitEvent): Promise<void> {
  // Never a native submission: the action goes to the host as an intent.
  event.preventDefault();
  if (status === 'pending' || !actions || !stateAccess) return;
  const ordered = [...fields];
  let firstInvalid: RegisteredField | null = null;
  for (const field of ordered) {
    const error = validateFieldValue(field.rules, stateAccess.read(field.state), labels());
    field.setError(error);
    if (error && !firstInvalid) firstInvalid = field;
  }
  if (firstInvalid) {
    firstInvalid.focus();
    return;
  }
  const values = actionValues(
    ordered.map((field) => [field.name, stateAccess.read(field.state)] as const)
  );
  if (!values) {
    status = 'failed';
    return;
  }
  status = 'pending';
  status = await actions.propose(action, values);
  // Spec 0.3.0: the form's `submit` event runs its `on.submit` actions once proposed.
  if (txPath !== undefined && status === 'confirmed') interaction?.dispatch(txPath, 'submit');
}
</script>

<form
  bind:this={form}
  class="tx-player-action-form"
  aria-label={label}
  aria-describedby={receipt ? receiptId : undefined}
  data-tx-player-action-form={action}
  data-status={status ?? undefined}
  novalidate
  onsubmit={onSubmit}
>
  {#if children}{@render children()}{/if}
  {#if receipt}
    <p class="tx-player-action-form__receipt" id={receiptId} data-tx-player-receipt={status}>{receipt}</p>
  {/if}
</form>
