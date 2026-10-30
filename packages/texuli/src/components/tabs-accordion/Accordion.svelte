<script lang="ts">
import { Accordion as AccordionPrimitive } from '@texuli/primitives/accordion';
import type { Snippet } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';
import { type ClassValue } from '../../internal/cx.ts';
import type { MotionProp } from '../../motion/contract.ts';
import { createSizeMotion } from '../../motion/seam.ts';
import Chevron from './Chevron.svelte';
import type { AccordionItemDef } from './types.ts';
import { type AccordionVariant, accordionRootClass } from './variants.ts';
import './tabs-accordion.css';
import { designDefaults } from '../../internal/design-defaults.ts';

type OwnProps = {
  items: readonly AccordionItemDef[];
  type?: 'single' | 'multiple';
  value?: string | string[];
  onValueChange?: (value: string | string[]) => void;
  /** Whether a single open item can collapse again. Default true. */
  collapsible?: boolean;
  headingLevel?: 2 | 3 | 4 | 5 | 6;
  variant?: AccordionVariant;
  disabled?: boolean;
  class?: ClassValue;
  content?: Snippet<[AccordionItemDef]>;
  /**
   * Motion (`texuli/motion`): panels animate their height open and closed
   * (`layout`, default on); `false` for none.
   */
  motion?: MotionProp;
  /** The rendered root element (bindable). */
  ref?: HTMLElement | null;
};

/** Extra attributes (`data-*`, `aria-*`, `id`, handlers…) land on the root element. */
type Props = OwnProps & Omit<HTMLAttributes<HTMLDivElement>, keyof OwnProps | 'children' | 'dir'>;

function asArray(v: string | string[] | undefined): string[] {
  return Array.isArray(v) ? v : v ? [v] : [];
}

const txDefaults = designDefaults('accordion');
let {
  items,
  type = 'single',
  value = $bindable(type === 'multiple' ? ([] as string[]) : ''),
  onValueChange,
  collapsible = true,
  headingLevel = 3,
  variant = txDefaults().variant ?? 'default',
  disabled = false,
  class: className,
  content,
  motion,
  ref = $bindable(null),
  ...rest
}: Props = $props();

const panelMotion = createSizeMotion({
  motion: () => motion,
  defaults: { layout: true, duration: 'base' },
});

// Local bindables so the primitive can own open state and still notify hosts.
let singleValue = $state(typeof value === 'string' ? value : '');
let multiValue = $state<string[]>(Array.isArray(value) ? value : []);

$effect(() => {
  if (type === 'multiple') {
    multiValue = asArray(value);
  } else {
    singleValue = asArray(value)[0] ?? '';
  }
});

const rootClass = $derived(
  accordionRootClass({
    variant,
    class: className,
  })
);
</script>

{#snippet body()}
  {#each items as item (item.value)}
    <AccordionPrimitive.Item
      value={item.value}
      disabled={item.disabled || disabled}
      class="tx-accordion__item"
      data-tx-accordion-item=""
    >
      <AccordionPrimitive.Header level={headingLevel} class="tx-accordion__header">
        <AccordionPrimitive.Trigger class="tx-accordion__trigger" data-tx-accordion-trigger="">
          {item.title}
          <Chevron class="tx-accordion__chevron" />
        </AccordionPrimitive.Trigger>
      </AccordionPrimitive.Header>
      <AccordionPrimitive.Content
        class="tx-accordion__content"
        data-tx-accordion-content=""
        motionHooks={panelMotion}
      >
        <div class="tx-accordion__content-inner">
          {#if content}
            {@render content(item)}
          {:else}
            {item.content}
          {/if}
        </div>
      </AccordionPrimitive.Content>
    </AccordionPrimitive.Item>
  {/each}
{/snippet}

{#if type === 'multiple'}
  <AccordionPrimitive.Root
    {...rest}
    bind:ref
    type="multiple"
    bind:value={multiValue}
    onValueChange={(next) => {
      multiValue = next;
      value = next;
      onValueChange?.(next);
    }}
    {disabled}
    class={rootClass}
    data-tx-accordion=""
    data-variant={variant}
  >
    {@render body()}
  </AccordionPrimitive.Root>
{:else}
  <AccordionPrimitive.Root
    {...rest}
    bind:ref
    type="single"
    bind:value={singleValue}
    onValueChange={(next) => {
      singleValue = next;
      value = next;
      onValueChange?.(next);
    }}
    {collapsible}
    {disabled}
    class={rootClass}
    data-tx-accordion=""
    data-variant={variant}
  >
    {@render body()}
  </AccordionPrimitive.Root>
{/if}
