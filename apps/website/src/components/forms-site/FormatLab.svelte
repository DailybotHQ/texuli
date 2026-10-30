<script lang="ts">
/**
 * /forms-page/ format lab: every named format of `@texuli/forms/model`
 * (`FORM_FORMATS`) checked live by `matchesFormat`, the owned linear-time
 * code a schema names instead of carrying a pattern. Each row's buttons
 * load its accepted and refused sample into the tester.
 */
import { type FormFormat, matchesFormat } from '@texuli/forms/model';
import { FORMAT_SAMPLES } from './formats.ts';

let format = $state<FormFormat>('email');
let value = $state('ada@example.com');
const verdict = $derived(matchesFormat(format, value));

function load(next: FormFormat, sample: string): void {
  format = next;
  value = sample;
}
</script>

<div class="lab" data-forms-formats="">
  <div class="lab__tester">
    <label class="lab__field">
      <span>Format</span>
      <select bind:value={format} data-forms-format-select="">
        {#each FORMAT_SAMPLES as sample (sample.format)}
          <option value={sample.format}>{sample.format}</option>
        {/each}
      </select>
    </label>
    <label class="lab__field lab__field--grow">
      <span>Value</span>
      <input type="text" bind:value spellcheck="false" autocomplete="off" />
    </label>
    <p class="lab__verdict" class:is-ok={verdict} data-forms-format-verdict="" aria-live="polite">
      {verdict ? 'Matches' : 'Does not match'} <code>{format}</code>
    </p>
  </div>
  <div class="lab__scroll" role="region" aria-label="Every named format" tabindex="0">
    <table class="lab__table">
      <caption>{FORMAT_SAMPLES.length} named formats; a schema can only name one</caption>
      <thead>
        <tr>
          <th scope="col">Format</th>
          <th scope="col">What it accepts</th>
          <th scope="col">Accepted</th>
          <th scope="col">Refused</th>
        </tr>
      </thead>
      <tbody>
        {#each FORMAT_SAMPLES as sample (sample.format)}
          <tr data-forms-format={sample.format}>
            <th scope="row"><code>{sample.format}</code></th>
            <td>{sample.note}</td>
            <td>
              <button
                type="button"
                class="lab__sample"
                aria-label={`Try ${sample.valid} as ${sample.format}`}
                onclick={() => load(sample.format, sample.valid)}><code>{sample.valid}</code></button
              >
            </td>
            <td>
              <button
                type="button"
                class="lab__sample lab__sample--bad"
                aria-label={`Try ${sample.invalid} as ${sample.format}`}
                onclick={() => load(sample.format, sample.invalid)}><code>{sample.invalid}</code></button
              >
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
</div>

<style>
  .lab {
    display: grid;
    gap: 0.9rem;
    min-inline-size: 0;
    padding: clamp(0.75rem, 2vw, 1.25rem);
    border: 1px solid var(--tx-border, CanvasText);
    border-radius: 1rem;
    background: var(--tx-surface, Canvas);
    color: var(--tx-foreground, CanvasText);
  }
  .lab__tester {
    display: flex;
    flex-wrap: wrap;
    align-items: end;
    gap: 0.75rem;
  }
  .lab__field {
    display: grid;
    gap: 0.25rem;
    font-size: 0.8125rem;
    font-weight: 600;
  }
  .lab__field--grow {
    flex: 1 1 14rem;
  }
  .lab__field select,
  .lab__field input {
    min-block-size: 2.25rem;
    padding-inline: 0.5rem;
    border: 1px solid var(--tx-border, CanvasText);
    border-radius: 0.5rem;
    background: var(--tx-background, Canvas);
    color: var(--tx-foreground, CanvasText);
    font: inherit;
    font-weight: 400;
  }
  .lab__verdict {
    margin: 0;
    padding: 0.4rem 0.75rem;
    border-radius: 999px;
    border: 1px solid var(--tx-danger, CanvasText);
    background: var(--tx-danger-soft, Canvas);
    color: var(--tx-danger-soft-foreground, CanvasText);
    font-size: 0.875rem;
    font-weight: 600;
  }
  .lab__verdict.is-ok {
    border-color: var(--tx-success, CanvasText);
    background: var(--tx-success-soft, Canvas);
    color: var(--tx-success-soft-foreground, CanvasText);
  }
  .lab__scroll {
    max-block-size: 26rem;
    overflow: auto;
  }
  .lab__scroll:focus-visible,
  .lab__sample:focus-visible {
    outline: 2px solid var(--tx-ring, Highlight);
    outline-offset: 2px;
  }
  .lab__table {
    inline-size: 100%;
    border-collapse: collapse;
    font-size: 0.875rem;
  }
  .lab__table caption {
    padding-block-end: 0.4rem;
    text-align: start;
    font-weight: 600;
  }
  .lab__table th,
  .lab__table td {
    padding: 0.35rem 0.5rem;
    border-block-end: 1px solid var(--tx-border, CanvasText);
    text-align: start;
    vertical-align: top;
  }
  .lab__sample {
    padding: 0.15rem 0.45rem;
    border: 1px solid var(--tx-border, ButtonBorder);
    border-radius: 0.4rem;
    background: var(--tx-background, ButtonFace);
    color: var(--tx-foreground, ButtonText);
    font: inherit;
    cursor: pointer;
    overflow-wrap: anywhere;
    text-align: start;
  }
  @media (forced-colors: active) {
    .lab__verdict {
      border-color: CanvasText;
    }
  }
</style>
