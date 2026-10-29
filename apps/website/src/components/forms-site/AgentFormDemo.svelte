<script lang="ts">
/**
 * /forms-page/ forms as agent data: the real `<Player>` at the untrusted
 * tier paints the agent's `schema-form` blueprint (spec 0.8.0) through the
 * form host of `@texuli/forms/host`. Submitting proposes the node's action
 * intent to this page (`onAction`), which confirms it and logs the answers.
 * "Send the hostile form" swaps in a schema with a `pattern` member: the
 * forms validator refuses it, the player paints nothing of it and lists the
 * diagnostics. The player and the host load after the island hydrates.
 */
import { onMount } from 'svelte';
import { AGENT_FORM_BLUEPRINT, FORM_ACTION, HOSTILE_FORM_BLUEPRINT } from './blueprint.ts';

type PlayerModule = typeof import('@texuli/player');
type FormHost = ReturnType<typeof import('@texuli/forms/host')['createFormPlayerHost']>;
interface DiagnosticsEvent {
  readonly diagnostics: readonly { code: string; severity: string; path?: string }[];
}

let player = $state.raw<PlayerModule | null>(null);
let host = $state.raw<FormHost | null>(null);
let failed = $state(false);
let hostile = $state(false);
let received = $state('');
let refused = $state.raw<readonly string[]>([]);
const blueprint = $derived(hostile ? HOSTILE_FORM_BLUEPRINT : AGENT_FORM_BLUEPRINT);

onMount(() => {
  let live = true;
  Promise.all([import('@texuli/player'), import('@texuli/forms/host')]).then(
    ([playerModule, hostModule]) => {
      if (!live) return;
      // Each Stepper is a navigation landmark; this name keeps it unique on the page.
      host = hostModule.createFormPlayerHost({ labels: { progress: 'Onboarding form progress' } });
      player = playerModule;
    },
    () => {
      failed = true;
    }
  );
  return () => {
    live = false;
  };
});

function onAction(intent: unknown): 'confirmed' {
  const record = intent as { action?: string; values?: Record<string, unknown> };
  received = JSON.stringify({ action: record.action, values: record.values }, null, 2);
  return 'confirmed';
}

function onDiagnostics(event: DiagnosticsEvent): void {
  const errors = event.diagnostics
    .filter((entry) => entry.severity === 'error')
    .map((entry) => `${entry.code}${entry.path ? ` at ${entry.path}` : ''}`);
  if (errors.length > 0 || hostile) refused = errors;
}

function toggle(next: boolean): void {
  hostile = next;
  refused = [];
  received = '';
}
</script>

<div class="agent-form" data-forms-agent="">
  <div class="agent-form__bar" role="group" aria-label="Which blueprint the agent sends">
    <button
      type="button"
      class="agent-form__button"
      aria-pressed={!hostile}
      onclick={() => toggle(false)}>Send the agent’s form</button
    >
    <button
      type="button"
      class="agent-form__button"
      aria-pressed={hostile}
      onclick={() => toggle(true)}>Send the hostile form</button
    >
  </div>
  <div class="agent-form__status" role="status" data-forms-agent-status="">
    {#if hostile && refused.length > 0}
      <p class="agent-form__refused" data-forms-agent-refused="">
        Refused before painting: {refused.join(', ')}. Nothing of it rendered.
      </p>
    {:else if received}
      <p>The host received <code>{FORM_ACTION}</code> and confirmed it.</p>
    {:else}
      <p>Answer and book: the player proposes the action to the host.</p>
    {/if}
  </div>
  <div class="agent-form__stage" data-forms-agent-stage="">
    {#if failed}
      <p role="alert">The player could not load. Reload the page to try again.</p>
    {:else if player && host}
      {#key hostile}
        <player.Player
          {blueprint}
          tier="untrusted"
          status="draft"
          label="Agent form (untrusted)"
          landmarks={false}
          loadTimeoutMs={8000}
          formHost={host}
          {onAction}
          {onDiagnostics}
        />
      {/key}
    {:else}
      <p data-forms-agent-loading="">Loading the player…</p>
    {/if}
  </div>
  {#if received}
    <pre class="agent-form__json" aria-label="The intent the host received" tabindex="0" data-forms-agent-intent="">{received}</pre>
  {/if}
</div>

<style>
  .agent-form {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 0.75rem;
    min-inline-size: 0;
    padding: clamp(0.75rem, 2vw, 1.25rem);
    border: 1px solid var(--tx-border, CanvasText);
    border-radius: 1rem;
    background: var(--tx-surface, Canvas);
    color: var(--tx-foreground, CanvasText);
  }
  .agent-form__bar {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }
  .agent-form__button {
    min-block-size: 2.25rem;
    padding-inline: 0.8rem;
    border: 1px solid var(--tx-border, ButtonBorder);
    border-radius: 0.5rem;
    background: var(--tx-background, ButtonFace);
    color: var(--tx-foreground, ButtonText);
    font: inherit;
    cursor: pointer;
  }
  .agent-form__button[aria-pressed='true'] {
    border-color: var(--tx-primary, Highlight);
    background: var(--tx-primary-soft, Canvas);
    color: var(--tx-primary-soft-foreground, CanvasText);
    font-weight: 600;
  }
  .agent-form__button:focus-visible,
  .agent-form__json:focus-visible {
    outline: 2px solid var(--tx-ring, Highlight);
    outline-offset: 2px;
  }
  .agent-form__status p {
    margin: 0;
    font-size: 0.875rem;
  }
  .agent-form__refused {
    padding: 0.5rem 0.75rem;
    border-inline-start: 4px solid var(--tx-danger, CanvasText);
    border-radius: 0.4rem;
    background: var(--tx-danger-soft, Canvas);
    color: var(--tx-danger-soft-foreground, CanvasText);
    overflow-wrap: anywhere;
  }
  .agent-form__stage {
    min-block-size: 18rem;
    min-inline-size: 0;
    padding: 0.75rem;
    border: 1px dashed var(--tx-border, CanvasText);
    border-radius: 0.75rem;
    background: var(--tx-background, Canvas);
  }
  .agent-form__json {
    margin: 0;
    max-block-size: 18rem;
    padding: 0.75rem;
    overflow: auto;
    border-radius: 0.6rem;
    background: var(--tx-muted, Canvas);
    font-size: 0.8125rem;
  }
  /* The player's diagnostics quote refused values verbatim; long ones wrap here. */
  .agent-form__stage :global(.tx-player__notice) {
    overflow-wrap: anywhere;
  }
  @media (forced-colors: active) {
    .agent-form__button[aria-pressed='true'] {
      border-color: Highlight;
    }
  }
</style>
