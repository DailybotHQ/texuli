<script lang="ts">
import { Switch as SwitchPrimitive } from '@texuli/primitives/switch';
import type { HTMLAttributes } from 'svelte/elements';
import { joinIds, splitControlProps } from '../../internal/control-props.ts';
import { type ClassValue, cx } from '../../internal/cx.ts';
import { type ChoiceSize, switchControlClass } from './variants.ts';
import './choice.css';
import { designDefaults, withDefault } from '../../internal/design-defaults.ts';

type Props = {
  checked?: boolean;
  defaultChecked?: boolean;
  name?: string;
  value?: string;
  disabled?: boolean;
  required?: boolean;
  id?: string;
  label?: string;
  description?: string;
  size?: ChoiceSize;
  onCheckedChange?: (checked: boolean) => void;
  class?: ClassValue;
  /** The rendered root element (bindable): field wrapper, or the control when unlabeled. */
  ref?: HTMLElement | null;
} & Omit<HTMLAttributes<HTMLDivElement>, 'id'>;

const uid = $props.id();

let {
  checked = $bindable(false),
  defaultChecked = false,
  name,
  value = 'on',
  disabled = false,
  required = false,
  id = `tx-switch-${uid}`,
  label,
  description,
  size: sizeProp,
  onCheckedChange,
  class: className,
  ref = $bindable(null),
  ...rest
}: Props = $props();
const txDefaults = designDefaults('choice');
const size = $derived(withDefault(sizeProp, txDefaults().size, 'md'));

// aria-*, data-*, handlers and form attributes name and wire the control;
// layout hooks (style, hidden…) stay on the wrapper.
const split = $derived(splitControlProps(rest));

const controlClass = $derived(
  switchControlClass({
    size,
    class: label ? undefined : className,
  })
);
</script>

{#snippet control()}
  <SwitchPrimitive.Root
    {...split.control}
    bind:checked
    {defaultChecked}
    {id}
    {name}
    {value}
    {disabled}
    {required}
    {onCheckedChange}
    class={controlClass}
    aria-describedby={joinIds(
      description && `${id}-description`,
      split.control['aria-describedby'] as string | undefined
    )}
    data-tx-choice="switch"
  >
    <SwitchPrimitive.Thumb class="tx-switch-thumb" />
  </SwitchPrimitive.Root>
{/snippet}

{#if label}
  <div
    bind:this={ref}
    class={cx('tx-choice tx-choice--switch', className)}
    data-tx-choice-field="switch"
    {...split.wrapper}
  >
    <div class="tx-choice__copy">
      <label class="tx-choice__label" for={id}>{label}</label>
      {#if description}
        <p class="tx-choice__description" id="{id}-description">{description}</p>
      {/if}
    </div>
    <span class="tx-choice__hit">{@render control()}</span>
  </div>
{:else}
  <span bind:this={ref} class="tx-choice__solo" data-tx-choice-field="switch-solo" {...split.wrapper}>
    {@render control()}
  </span>
{/if}
