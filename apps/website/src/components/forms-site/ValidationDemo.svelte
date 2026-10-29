<script lang="ts">
/**
 * /forms-page/ validation: every closed rule of `@texuli/forms`, a host
 * validator (async, abortable: it answers after a short delay and says a
 * few fictional handles are taken), a cross-field rule, the error summary
 * that takes focus and links to each answer, and server errors returned
 * from `onSubmit`, which show like local ones.
 */
import { SchemaForm } from '@texuli/forms';
import { type FormValidator, validateFormSchema } from '@texuli/forms/model';
import { HANDLE_VALIDATOR, TAKEN_HANDLES, VALIDATION_SCHEMA } from './schemas.ts';

const result = validateFormSchema(VALIDATION_SCHEMA, { validators: [HANDLE_VALIDATOR] });
let serverRefuses = $state(false);
let round = $state(0);
let outcome = $state('Nothing sent yet.');
/** The trial starts filled in; move the end before the start to see the cross-field rule. */
const TRIAL = { trialStart: '2026-11-02', trialEnd: '2026-11-30' };

const handleAvailable: FormValidator = (value, { signal }) =>
  new Promise((done) => {
    const timer = setTimeout(() => {
      done(
        typeof value === 'string' && TAKEN_HANDLES.includes(value)
          ? `${value} is taken. Try another handle.`
          : null
      );
    }, 450);
    signal.addEventListener('abort', () => clearTimeout(timer), { once: true });
  });
</script>

<div class="validation" data-forms-validation="">
  <div class="validation__bar">
    <label class="validation__toggle">
      <input type="checkbox" bind:checked={serverRefuses} data-forms-server-refuses="" />
      <span>The server refuses the next submit</span>
    </label>
    <button type="button" class="validation__button" onclick={() => (round += 1)}>Start over</button>
    <p class="validation__outcome" data-forms-validation-outcome="">{outcome}</p>
  </div>
  {#key round}
    {#if result.ok}
      <SchemaForm
        form={result.form}
        headingLevel={3}
        values={TRIAL}
        validators={{ [HANDLE_VALIDATOR]: handleAvailable }}
        onSubmit={({ values }) => {
          if (serverRefuses) {
            serverRefuses = false;
            outcome = 'The server answered with field errors.';
            return {
              ok: false,
              errors: { owner: `${String(values.owner)} already owns a workspace.` },
              message: 'The server could not create the workspace.',
            };
          }
          outcome = `Created ${String(values.handle)} with ${String(values.seats)} seats.`;
          return { ok: true };
        }}
      />
    {:else}
      <p role="alert">The validation schema did not validate.</p>
    {/if}
  {/key}
</div>

<style>
  .validation {
    display: grid;
    gap: 0.9rem;
    min-inline-size: 0;
    padding: clamp(0.75rem, 2vw, 1.25rem);
    border: 1px solid var(--tx-border, CanvasText);
    border-radius: 1rem;
    background: var(--tx-surface, Canvas);
    color: var(--tx-foreground, CanvasText);
  }
  .validation__bar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.6rem 1rem;
  }
  .validation__toggle {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    font-size: 0.875rem;
  }
  .validation__button {
    min-block-size: 2.25rem;
    padding-inline: 0.8rem;
    border: 1px solid var(--tx-border, ButtonBorder);
    border-radius: 0.5rem;
    background: var(--tx-background, ButtonFace);
    color: var(--tx-foreground, ButtonText);
    font: inherit;
    cursor: pointer;
  }
  .validation__button:focus-visible {
    outline: 2px solid var(--tx-ring, Highlight);
    outline-offset: 2px;
  }
  .validation__outcome {
    margin: 0;
    font-size: 0.875rem;
    color: var(--tx-muted-foreground, CanvasText);
  }
</style>
