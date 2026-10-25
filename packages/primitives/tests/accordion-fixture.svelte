<script lang="ts">
import { Accordion, type AccordionHeadingLevel } from '../src/accordion/index.ts';

type Props = {
  type?: 'single' | 'multiple';
  value?: string | string[];
  collapsible?: boolean;
  disabled?: boolean;
  orientation?: 'vertical' | 'horizontal';
  loop?: boolean;
  dir?: 'ltr' | 'rtl';
  level?: AccordionHeadingLevel;
  forceMount?: boolean;
  childTrigger?: boolean;
  nested?: boolean;
  onValueChange?: (value: string | string[]) => void;
  onTriggerClick?: (event: MouseEvent) => void;
};

let {
  type = 'single',
  value = $bindable(type === 'multiple' ? [] : ''),
  collapsible = true,
  disabled = false,
  orientation = 'vertical',
  loop = true,
  dir,
  level = 3,
  forceMount = false,
  childTrigger = false,
  nested = false,
  onValueChange,
  onTriggerClick,
}: Props = $props();

const items = [
  { value: 'shipping', title: 'Shipping', body: 'Orders ship within two fictional days.' },
  { value: 'returns', title: 'Returns', body: 'Return any item within 30 days.' },
  { value: 'warranty', title: 'Warranty', body: 'Covered for a year.', disabled: true },
  { value: 'support', title: 'Support', body: 'Write to help@example.com.' },
];
</script>

<button type="button">Before</button>
{#if type === 'multiple'}
  <Accordion.Root
    type="multiple"
    bind:value={value as string[]}
    {disabled}
    {orientation}
    {loop}
    {dir}
    onValueChange={(next) => onValueChange?.(next)}
    data-testid="root"
  >
    {#each items as item (item.value)}
      <Accordion.Item value={item.value} disabled={item.disabled} data-testid={`item-${item.value}`}>
        <Accordion.Header {level}>
          <Accordion.Trigger onclick={onTriggerClick}>{item.title}</Accordion.Trigger>
        </Accordion.Header>
        <Accordion.Content {forceMount}><p>{item.body}</p></Accordion.Content>
      </Accordion.Item>
    {/each}
  </Accordion.Root>
{:else}
  <Accordion.Root
    type="single"
    bind:value={value as string}
    {collapsible}
    {disabled}
    {orientation}
    {loop}
    {dir}
    onValueChange={(next) => onValueChange?.(next)}
    data-testid="root"
  >
    {#each items as item (item.value)}
      <Accordion.Item value={item.value} disabled={item.disabled} data-testid={`item-${item.value}`}>
        <Accordion.Header {level}>
          {#if childTrigger}
            <Accordion.Trigger onclick={onTriggerClick}>
              {#snippet child({ props })}
                <span {...props} role="button" tabindex="0" class="custom-trigger">{item.title}</span>
              {/snippet}
            </Accordion.Trigger>
          {:else}
            <Accordion.Trigger onclick={onTriggerClick}>{item.title}</Accordion.Trigger>
          {/if}
        </Accordion.Header>
        <Accordion.Content {forceMount}>
          <p>{item.body}</p>
          {#if nested && item.value === 'support'}
            <Accordion.Root type="single" value="inner-a">
              <Accordion.Item value="inner-a">
                <Accordion.Header level={4}><Accordion.Trigger>Email</Accordion.Trigger></Accordion.Header>
                <Accordion.Content><p>help@example.com</p></Accordion.Content>
              </Accordion.Item>
              <Accordion.Item value="inner-b">
                <Accordion.Header level={4}><Accordion.Trigger>Phone</Accordion.Trigger></Accordion.Header>
                <Accordion.Content><p>A fictional number.</p></Accordion.Content>
              </Accordion.Item>
            </Accordion.Root>
          {/if}
        </Accordion.Content>
      </Accordion.Item>
    {/each}
  </Accordion.Root>
{/if}
<button type="button">After</button>
