<script lang="ts">
import { onMount } from 'svelte';
import type { FieldKind } from '../actions.ts';
import { getPlayerStateAccess } from '../context.ts';
import { getActionFormContext } from './form-context.ts';

let {
  name,
  state: stateName,
  label,
  kind = 'text',
  required = false,
  autocomplete,
  pattern,
  minLength,
  maxLength,
  min,
  max,
  placeholder,
}: {
  name: string;
  state: string;
  label: string;
  kind?: FieldKind;
  required?: boolean;
  autocomplete?: string;
  pattern?: string;
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  placeholder?: string;
} = $props();

const access = getPlayerStateAccess();
const form = getActionFormContext();
const id = $props.id();
let input = $state<HTMLInputElement | HTMLTextAreaElement | null>(null);
let error = $state<string | null>(null);
let declaration = $derived(access?.declaration(stateName));
let cap = $derived(
  Math.min(
    maxLength ?? Number.POSITIVE_INFINITY,
    declaration?.type === 'string' ? declaration.maxLength : Number.POSITIVE_INFINITY
  )
);
let value = $derived(access?.read(stateName));
let inputType = $derived(kind === 'multiline' ? undefined : kind === 'number' ? 'number' : kind);

onMount(() =>
  form?.register({
    name,
    state: stateName,
    rules: { label, kind, required, pattern, minLength, maxLength, min, max },
    setError: (message) => {
      error = message;
    },
    focus: () => input?.focus(),
  })
);

function onInput(event: Event): void {
  const raw = (event.currentTarget as HTMLInputElement | HTMLTextAreaElement).value;
  if (kind === 'number') {
    const number = raw === '' ? Number.NaN : Number(raw);
    if (Number.isFinite(number)) access?.write(stateName, number);
  } else access?.write(stateName, raw);
  error = null;
}
</script>

<div class="tx-player-form-field" data-tx-player-field={name} data-invalid={error ? '' : undefined}>
  <label for={id}>{label}{#if required}<span aria-hidden="true"> *</span>{/if}</label>
  {#if kind === 'multiline'}
    <textarea
      bind:this={input}
      {id}
      {name}
      {placeholder}
      required={required || undefined}
      maxlength={Number.isFinite(cap) ? cap : undefined}
      autocomplete={(autocomplete ?? 'off') as AutoFill}
      aria-invalid={error ? 'true' : undefined}
      aria-describedby={error ? `${id}-error` : undefined}
      value={value === undefined ? '' : String(value)}
      oninput={onInput}
    ></textarea>
  {:else}
    <input
      bind:this={input}
      {id}
      {name}
      type={inputType}
      {placeholder}
      required={required || undefined}
      maxlength={kind !== 'number' && Number.isFinite(cap) ? cap : undefined}
      min={kind === 'number' ? min : undefined}
      max={kind === 'number' ? max : undefined}
      autocomplete={(autocomplete ?? 'off') as AutoFill}
      aria-invalid={error ? 'true' : undefined}
      aria-describedby={error ? `${id}-error` : undefined}
      value={value === undefined ? '' : String(value)}
      oninput={onInput}
    />
  {/if}
  {#if error}<p class="tx-player-form-field__error" id={`${id}-error`}>{error}</p>{/if}
</div>
