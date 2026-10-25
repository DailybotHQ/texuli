<script lang="ts">
import type { Snippet } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';
import { type ClassValue, cx } from '../../internal/cx.ts';
import Description from './Description.svelte';
import FieldError from './FieldError.svelte';
import Label from './Label.svelte';
import type { FieldControl } from './types.ts';
import { type FieldOrientation, fieldRootClass } from './variants.ts';
import './field.css';

type Props = Omit<HTMLAttributes<HTMLDivElement>, 'children'> & {
  label: string;
  description?: string;
  /** Error message; when present the control is marked `aria-invalid`. */
  error?: string | null;
  required?: boolean;
  disabled?: boolean;
  /** Control id; generated when omitted. */
  id?: string;
  /** Visually hide the label (it stays available to assistive tech). */
  hideLabel?: boolean;
  orientation?: FieldOrientation;
  class?: ClassValue;
  children: Snippet<[FieldControl]>;
};

const uid = $props.id();

let {
  label,
  description,
  error = null,
  required = false,
  disabled = false,
  id = `field-${uid}`,
  hideLabel = false,
  orientation = 'vertical',
  class: className,
  children,
  ...rest
}: Props = $props();

const descriptionId = $derived(`${id}-description`);
const errorId = $derived(`${id}-error`);
const invalid = $derived(Boolean(error));
const describedBy = $derived(
  [description ? descriptionId : null, invalid ? errorId : null].filter(Boolean).join(' ') ||
    undefined
);
const control: FieldControl = $derived({
  id,
  describedBy,
  invalid,
  required,
  props: {
    id,
    'aria-describedby': describedBy,
    'aria-invalid': invalid || undefined,
    'aria-required': required || undefined,
  },
});

const classes = $derived(cx(fieldRootClass({ orientation }), className));
</script>

<div
  class={classes}
  data-tx-field=""
  data-invalid={invalid ? '' : undefined}
  data-disabled={disabled ? '' : undefined}
  data-required={required ? '' : undefined}
  {...rest}
>
  <Label for={id} {required} srOnly={hideLabel}>{label}</Label>
  <div class="tx-field-control">
    {@render children(control)}
  </div>
  {#if description}
    <Description id={descriptionId}>{description}</Description>
  {/if}
  <FieldError id={errorId} show={invalid}>{error}</FieldError>
</div>
