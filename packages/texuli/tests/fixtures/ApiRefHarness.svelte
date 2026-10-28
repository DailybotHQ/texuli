<script lang="ts">
/**
 * G5: one styled component per kind, mounted with `bind:ref` and a
 * `data-probe` / `aria-describedby` pair passed as rest attributes.
 */

import { Carousel } from '../../src/components/carousel/index.ts';
import { RadioGroup } from '../../src/components/choice/index.ts';
import { AlertDialog, Dialog } from '../../src/components/dialog/index.ts';
import { EmptyState } from '../../src/components/empty/index.ts';
import { Field, Form } from '../../src/components/field/index.ts';
import { TextCounter } from '../../src/components/input/index.ts';
import { Code, CopyButton } from '../../src/components/kbd-code/index.ts';
import { Breadcrumb } from '../../src/components/navigation/index.ts';
import { ScrollArea } from '../../src/components/scroll-area/index.ts';
import { Slider } from '../../src/components/slider/index.ts';
import { Stat } from '../../src/components/stat/index.ts';
import { Stepper, Wizard } from '../../src/components/stepper/index.ts';
import { Table, TableBody, TableCell, TableRow } from '../../src/components/table/index.ts';
import { Accordion, Collapsible, Tabs } from '../../src/components/tabs-accordion/index.ts';
import { Timeline } from '../../src/components/timeline/index.ts';
import { ToggleGroup, ToggleGroupItem } from '../../src/components/toggle/index.ts';
import {
  Toolbar,
  ToolbarButton,
  ToolbarGroup,
  ToolbarGroupItem,
  ToolbarLink,
  ToolbarSeparator,
} from '../../src/components/toolbar/index.ts';
import type { ApiRefKind } from './api-ref-kind.ts';

let {
  kind,
  ref = $bindable(null as HTMLElement | null),
}: {
  kind: ApiRefKind;
  ref?: HTMLElement | null;
} = $props();

const probe = { 'data-probe': 'probe', 'aria-describedby': 'probe-note' } as const;
const steps = [
  { id: 'one', label: 'One' },
  { id: 'two', label: 'Two' },
];
const items = [
  { id: 'a', value: 'a', label: 'A', title: 'A', content: 'Alpha' },
  { id: 'b', value: 'b', label: 'B', title: 'B', content: 'Beta' },
];
</script>

<p id="probe-note">Probe note</p>
{#if kind === 'dialog'}
  <Dialog open title="Dialog" bind:ref {...probe}>Body</Dialog>
{:else if kind === 'alert-dialog'}
  <AlertDialog open title="Alert" bind:ref {...probe} />
{:else if kind === 'tabs'}
  <Tabs items={items} label="Tabs" bind:ref {...probe} />
{:else if kind === 'accordion'}
  <Accordion items={items} bind:ref {...probe} />
{:else if kind === 'collapsible'}
  <Collapsible label="More" bind:ref {...probe}>Hidden</Collapsible>
{:else if kind === 'text-counter'}
  <TextCounter label="Title" bind:ref {...probe} />
{:else if kind === 'toolbar'}
  <Toolbar aria-label="Format" bind:ref {...probe}>
    <ToolbarButton>Bold</ToolbarButton>
  </Toolbar>
{:else if kind === 'toolbar-button'}
  <Toolbar aria-label="Format"><ToolbarButton bind:ref {...probe}>Bold</ToolbarButton></Toolbar>
{:else if kind === 'toolbar-group'}
  <Toolbar aria-label="Format">
    <ToolbarGroup aria-label="Align" bind:ref {...probe}>
      <ToolbarGroupItem value="left">Left</ToolbarGroupItem>
    </ToolbarGroup>
  </Toolbar>
{:else if kind === 'toolbar-group-item'}
  <Toolbar aria-label="Format">
    <ToolbarGroup aria-label="Align">
      <ToolbarGroupItem value="left" bind:ref {...probe}>Left</ToolbarGroupItem>
    </ToolbarGroup>
  </Toolbar>
{:else if kind === 'toolbar-link'}
  <Toolbar aria-label="Format"><ToolbarLink href="/help" bind:ref {...probe}>Help</ToolbarLink></Toolbar>
{:else if kind === 'toolbar-separator'}
  <Toolbar aria-label="Format"><ToolbarSeparator bind:ref {...probe} /></Toolbar>
{:else if kind === 'toggle-group'}
  <ToggleGroup aria-label="Views" bind:ref {...probe}>
    <ToggleGroupItem value="list">List</ToggleGroupItem>
  </ToggleGroup>
{:else if kind === 'stepper'}
  <Stepper {steps} current={0} bind:ref {...probe} />
{:else if kind === 'wizard'}
  <Wizard {steps} bind:ref {...probe}>
    {#snippet content({ step })}<p>{step.label}</p>{/snippet}
  </Wizard>
{:else if kind === 'breadcrumb'}
  <Breadcrumb items={[{ label: 'Home', href: '/' }, { label: 'Page' }]} bind:ref {...probe} />
{:else if kind === 'carousel'}
  <Carousel items={items} label="Slides" bind:ref {...probe} />
{:else if kind === 'table'}
  <Table label="People" bind:ref {...probe}>
    <TableBody><TableRow><TableCell>Ada</TableCell></TableRow></TableBody>
  </Table>
{:else if kind === 'table-row'}
  <Table label="People">
    <TableBody><TableRow bind:ref {...probe}><TableCell>Ada</TableCell></TableRow></TableBody>
  </Table>
{:else if kind === 'field'}
  <Field label="Name" bind:ref {...probe}><input aria-label="Name" /></Field>
{:else if kind === 'form'}
  <Form bind:ref {...probe}><input aria-label="Name" /></Form>
{:else if kind === 'empty-state'}
  <EmptyState title="Nothing" bind:ref {...probe} />
{:else if kind === 'code'}
  <Code value="x" bind:ref {...probe} />
{:else if kind === 'copy-button'}
  <CopyButton value="x" bind:ref {...probe} />
{:else if kind === 'timeline'}
  <Timeline items={[]} bind:ref {...probe} />
{:else if kind === 'stat'}
  <Stat label="Users" value={3} bind:ref {...probe} />
{:else if kind === 'scroll-area'}
  <ScrollArea label="Log" bind:ref {...probe}>Lines</ScrollArea>
{:else if kind === 'radio-group'}
  <RadioGroup
    aria-label="Size"
    items={[{ value: 's', label: 'Small' }]}
    bind:ref
    {...probe}
  />
{:else if kind === 'slider'}
  <Slider label="Volume" value={3} bind:ref {...probe} />
{/if}
