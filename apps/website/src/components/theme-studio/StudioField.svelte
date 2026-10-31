<script lang="ts">
/**
 * One field of the design-system document: a labelled Texuli control for its
 * kind, committed on change, with the spec's issues at its path shown under
 * it in plain language (code and JSON path kept, so the refusal is exact).
 */
import { Switch } from 'texuli/choice';
import { Input, Textarea } from 'texuli/input';
import {
  explainCode,
  type FieldSpec,
  formatValue,
  issuePath,
  parseValue,
  type StudioIssue,
} from './ds-studio.ts';

let {
  spec,
  value,
  issues = [],
  inherited = '',
  oncommit,
}: {
  spec: FieldSpec;
  value: unknown;
  issues?: readonly StudioIssue[];
  /** What applies when the field is empty (a base or default), for the placeholder. */
  inherited?: string;
  oncommit: (spec: FieldSpec, value: unknown) => void;
} = $props();

const id = $derived(`ds-field-${spec.path.join('-').replace(/[^A-Za-z0-9-]/g, '_')}`);
const issueId = $derived(`${id}-issue`);
const helpId = $derived(`${id}-help`);
const path = $derived(issuePath(spec.path));
let text = $state('');

$effect(() => {
  text = formatValue(spec, value);
});

const describedBy = $derived(
  [spec.help ? helpId : '', issues.length > 0 ? issueId : ''].filter(Boolean).join(' ') || undefined
);
const swatch = $derived(
  /^#[0-9a-fA-F]{6}$/.test(String(text ?? '').trim()) ? String(text).trim() : ''
);
const placeholder = $derived(inherited ? `${inherited} (inherited)` : (spec.placeholder ?? ''));

function commit(): void {
  // A number input binds a number (or null when empty): the parser reads text.
  oncommit(spec, parseValue(spec, text == null ? '' : String(text)));
}

function onKey(event: KeyboardEvent): void {
  if (event.key === 'Enter' && spec.kind !== 'lines' && spec.kind !== 'map') {
    event.preventDefault();
    commit();
  }
}

function onPick(event: Event): void {
  text = (event.currentTarget as HTMLInputElement).value;
  commit();
}

function onSelect(event: Event): void {
  text = (event.currentTarget as HTMLSelectElement).value;
  commit();
}
</script>

<div class="field" data-tx-ds-field={path} data-invalid={issues.length > 0 ? '' : undefined}>
  {#if spec.kind === 'bool'}
    <Switch
      id={id}
      label={spec.label}
      checked={value === true}
      aria-describedby={describedBy}
      onCheckedChange={(checked: boolean) => oncommit(spec, checked ? true : undefined)}
    />
  {:else}
    <label class="field__label" for={id}>
      {spec.label}{#if spec.unit}<span class="field__unit"> ({spec.unit})</span>{/if}
    </label>
    {#if spec.kind === 'enum' || spec.kind === 'modes'}
      <select
        class="field__select"
        id={id}
        value={text}
        aria-invalid={issues.length > 0 ? 'true' : undefined}
        aria-describedby={describedBy}
        onchange={onSelect}
      >
        <option value="">{inherited ? `Inherited (${inherited})` : 'Not set'}</option>
        {#each spec.options ?? [] as option (option)}
          <option value={option}>{option}</option>
        {/each}
      </select>
    {:else if spec.kind === 'lines' || spec.kind === 'map'}
      <Textarea
        id={id}
        rows={3}
        bind:value={text}
        placeholder={placeholder}
        aria-invalid={issues.length > 0 ? 'true' : undefined}
        aria-describedby={describedBy}
        onchange={commit}
      />
    {:else}
      <div class="field__row">
        <Input
          id={id}
          type={spec.kind === 'number' || spec.kind === 'integer' ? 'number' : 'text'}
          bind:value={text}
          min={spec.min}
          max={spec.max}
          step={spec.step}
          placeholder={placeholder}
          spellcheck="false"
          autocomplete="off"
          aria-invalid={issues.length > 0 ? 'true' : undefined}
          aria-describedby={describedBy}
          onchange={commit}
          onkeydown={onKey}
        />
        {#if spec.kind === 'color'}
          <input
            class="field__picker"
            type="color"
            value={swatch || '#000000'}
            aria-label={`Pick ${spec.label}`}
            onchange={onPick}
          />
        {/if}
      </div>
    {/if}
  {/if}
  {#if spec.help}
    <p class="field__help" id={helpId}>{spec.help}</p>
  {/if}
  {#if issues.length > 0}
    <ul class="field__issues" id={issueId} data-tx-ds-field-issues="">
      {#each issues as issue, index (index)}
        <li>
          <strong>{explainCode(issue.code)}</strong>
          <span class="field__code"><code>{issue.code}</code> at <code>{issue.path}</code></span>
          {#if issue.message}<span class="field__detail">{issue.message}</span>{/if}
        </li>
      {/each}
    </ul>
  {/if}
</div>

<style>
  .field {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 0.3rem;
    min-inline-size: 0;
  }
  .field__label {
    font-size: 0.875rem;
    font-weight: 600;
  }
  .field__unit {
    font-weight: 400;
  }
  .field__row {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 0.4rem;
    align-items: center;
  }
  .field__row:has(> :only-child) {
    grid-template-columns: minmax(0, 1fr);
  }
  .field__select {
    min-block-size: 2.5rem;
    padding: 0.4rem 0.6rem;
    border: 1px solid var(--tx-border);
    border-radius: var(--tx-radius, 0.5rem);
    background: var(--tx-background);
    color: var(--tx-foreground);
    font: inherit;
  }
  .field__picker {
    inline-size: 2.75rem;
    block-size: 2.5rem;
    padding: 0.15rem;
    border: 1px solid var(--tx-border);
    border-radius: var(--tx-radius, 0.5rem);
    background: var(--tx-background);
    cursor: pointer;
  }
  .field__select:focus-visible,
  .field__picker:focus-visible {
    outline: 2px solid var(--tx-ring);
    outline-offset: 2px;
  }
  .field__help {
    margin: 0;
    font-size: 0.8125rem;
    color: var(--tx-muted-foreground);
  }
  .field__issues {
    margin: 0;
    padding: 0.4rem 0.6rem;
    list-style: none;
    display: grid;
    gap: 0.35rem;
    border-inline-start: 3px solid var(--tx-destructive);
    background: var(--tx-destructive-soft, var(--tx-muted));
    color: var(--tx-destructive-soft-foreground, var(--tx-foreground));
    font-size: 0.8125rem;
  }
  .field__issues li {
    display: grid;
    gap: 0.1rem;
  }
  .field__code,
  .field__detail {
    overflow-wrap: anywhere;
  }
  @media (forced-colors: active) {
    .field__select,
    .field__picker {
      border-color: CanvasText;
    }
    .field__issues {
      border-inline-start-color: CanvasText;
    }
  }
</style>
