<script lang="ts">
import { untrack } from 'svelte';
import {
  getPlayerActionAccess,
  getPlayerFormHost,
  getPlayerInteraction,
  getPlayerLabels,
} from '../context.ts';
import type { FormPlayerSubmitResult } from '../form-host.ts';
import { formActionValues } from '../form-values.ts';

/**
 * `schema-form` (spec 0.8.0, ADR-015): a form as data, painted by the
 * host's `formHost` (`createFormPlayerHost` from `@texuli/forms/host`), so
 * the form engine stays out of the player. The draft already passed
 * `validateDraft` with the host's `checkForm` at the player's tier; the host
 * validates the schema again before it paints. Submitting proposes the
 * `action` intent to the host with the submitted values (visible, enabled
 * fields only), like `action-form`; once confirmed the node's `submit`
 * event runs. Values map to scalar action values with `formActionValues`.
 */

let {
  action,
  schema,
  label,
  txPath,
}: { action: string; schema: unknown; label?: string; txPath?: string } = $props();

const actions = getPlayerActionAccess();
const interaction = getPlayerInteraction();
const labels = getPlayerLabels();
const formHost = getPlayerFormHost();

let target = $state<HTMLElement | null>(null);
const host = $derived(formHost().host);
const tier = $derived(formHost().tier);

async function submit(values: Readonly<Record<string, unknown>>): Promise<FormPlayerSubmitResult> {
  const text = labels();
  if (!actions?.available()) return { ok: false, message: text.actionUnavailable };
  const status = await actions.propose(action, formActionValues(values));
  if (status === 'confirmed') {
    if (txPath !== undefined) interaction?.dispatch(txPath, 'submit');
    return { ok: true };
  }
  return {
    ok: false,
    message:
      status === 'rejected'
        ? text.actionRejected
        : status === 'unavailable'
          ? text.actionUnavailable
          : text.actionFailed,
  };
}

$effect(() => {
  const presenter = host;
  const presentTier = tier;
  const node = target;
  const nextSchema = schema;
  const nextAction = action;
  const formLabel = label;
  if (!presenter || !node) return;
  const cleanup = untrack(() =>
    presenter.present({
      schema: nextSchema,
      action: nextAction,
      ...(formLabel !== undefined ? { formLabel } : {}),
      tier: presentTier,
      get active() {
        return formHost().active;
      },
      get labels() {
        return { submitted: labels().actionConfirmed };
      },
      get target() {
        return target;
      },
      submit,
    })
  );
  if (typeof cleanup === 'function') return cleanup;
});
</script>

{#if host}
  <div bind:this={target} class="tx-player-schema-form" data-tx-player-schema-form={action}></div>
{:else}
  <p class="tx-player-schema-form__refused" data-tx-player-schema-form-refused="">{labels().actionUnavailable}</p>
{/if}
