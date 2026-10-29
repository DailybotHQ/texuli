<script lang="ts">
/**
 * Audit for the G26 pattern in primitives: every part below binds its own
 * handler on an element and also takes the same handler from the consumer.
 * The consumer handler is recorded in `log`; tests check it ran AND the part's
 * own behavior still happened.
 */
import { Calendar, CalendarDate } from '../../src/calendar/index.ts';
import { CollapsibleRoot } from '../../src/collapsible/index.ts';
import { ListboxOption, ListboxRoot } from '../../src/listbox/index.ts';
import { PinInput } from '../../src/pin-input/index.ts';
import { RadioGroup } from '../../src/radio-group/index.ts';
import { Tabs } from '../../src/tabs/index.ts';
import { TagsInput } from '../../src/tags-input/index.ts';
import { Toggle, ToggleGroup } from '../../src/toggle/index.ts';

let {
  kind,
  log = [],
  prevent = false,
  ref = $bindable(null as HTMLElement | null),
}: {
  kind:
    | 'radio-item'
    | 'toggle'
    | 'toggle-group-item'
    | 'tabs-trigger'
    | 'listbox'
    | 'pin-input'
    | 'tags-input-tag'
    | 'calendar-grid'
    | 'collapsible';
  log?: string[];
  /** The consumer handler calls `preventDefault()` (radio item only). */
  prevent?: boolean;
  ref?: HTMLElement | null;
} = $props();

const note = (name: string) => () => {
  log.push(name);
};

let radio = $state('a');
let pressed = $state(false);
let group = $state<string | string[]>('');
let tab = $state('a');
let listbox = $state<string | readonly string[] | undefined>();
let pin = $state('');
let tags = $state(['design']);
let date = $state<CalendarDate | null>(new CalendarDate(2024, 2, 15));
</script>

{#if kind === 'radio-item'}
  <RadioGroup.Root aria-label="Plan" bind:value={radio}>
    <RadioGroup.Item value="a" aria-label="A" />
    <RadioGroup.Item
      value="b"
      aria-label="B"
      onclick={(event: MouseEvent) => {
        log.push('click');
        if (prevent) event.preventDefault();
      }}
    />
  </RadioGroup.Root>
  <output data-testid="state">{radio}</output>
{:else if kind === 'toggle'}
  <Toggle.Root aria-label="Bold" bind:pressed onclick={note('click')}>B</Toggle.Root>
  <output data-testid="state">{pressed}</output>
{:else if kind === 'toggle-group-item'}
  <ToggleGroup.Root type="single" aria-label="Align" bind:value={group}>
    <ToggleGroup.Item value="left" aria-label="Left" onclick={note('click')}>L</ToggleGroup.Item>
  </ToggleGroup.Root>
  <output data-testid="state">{group}</output>
{:else if kind === 'tabs-trigger'}
  <Tabs.Root bind:value={tab}>
    <Tabs.List aria-label="Sections">
      <Tabs.Trigger value="a">A</Tabs.Trigger>
      <Tabs.Trigger value="b" onclick={note('click')}>B</Tabs.Trigger>
    </Tabs.List>
    <Tabs.Content value="a">A</Tabs.Content>
    <Tabs.Content value="b">B</Tabs.Content>
  </Tabs.Root>
  <output data-testid="state">{tab}</output>
{:else if kind === 'listbox'}
  <ListboxRoot
    aria-label="Colors"
    bind:value={listbox}
    items={[
      { value: 'amber', label: 'Amber' },
      { value: 'blue', label: 'Blue' },
    ]}
    onkeydown={note('keydown')}
  >
    <ListboxOption value="amber" />
    <ListboxOption value="blue" />
  </ListboxRoot>
  <output data-testid="state">{String(listbox ?? '')}</output>
{:else if kind === 'pin-input'}
  <PinInput.Root
    aria-label="Code"
    maxlength={4}
    bind:value={pin}
    oninput={note('input')}
    onfocus={note('focus')}
  />
  <output data-testid="state">{pin}</output>
{:else if kind === 'tags-input-tag'}
  <TagsInput.Root aria-label="Topics" bind:value={tags}>
    {#snippet children({ tags: list })}
      <TagsInput.List>
        {#each list as tag, index (`${index}-${tag}`)}
          <TagsInput.Tag {index} onfocus={note('focus')}>{tag}</TagsInput.Tag>
        {/each}
      </TagsInput.List>
      <TagsInput.Input aria-label="Add a topic" />
    {/snippet}
  </TagsInput.Root>
{:else if kind === 'calendar-grid'}
  <Calendar.Root bind:value={date} aria-label="Date">
    <Calendar.Grid onkeydown={note('keydown')} />
  </Calendar.Root>
  <output data-testid="state">{date?.toString() ?? ''}</output>
{:else if kind === 'collapsible'}
  <CollapsibleRoot bind:ref data-probe="probe" aria-describedby="note">
    <p id="note">Details</p>
  </CollapsibleRoot>
{/if}
