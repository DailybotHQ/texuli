<script lang="ts">
import type { HarnessProps } from '../../../primitives/tests/support/contract.ts';
import { Carousel } from '../../src/components/carousel/index.ts';
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '../../src/components/resizable/index.ts';
import { ScrollArea } from '../../src/components/scroll-area/index.ts';
import { AppNav, Sidebar } from '../../src/components/sidebar/index.ts';
import { Stepper, Wizard } from '../../src/components/stepper/index.ts';
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableEmpty,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '../../src/components/table/index.ts';
import { Accordion, Collapsible, Tabs } from '../../src/components/tabs-accordion/index.ts';
import { Toggle, ToggleGroup, ToggleGroupItem } from '../../src/components/toggle/index.ts';
import {
  Toolbar,
  ToolbarButton,
  ToolbarGroup,
  ToolbarGroupItem,
  ToolbarLink,
  ToolbarSeparator,
} from '../../src/components/toolbar/index.ts';
import { TreeView } from '../../src/components/tree/index.ts';

let { p, refs }: HarnessProps = $props();
const k = (name: string) => `components/${name}`;
const steps = [
  { id: 'a', label: 'Account' },
  { id: 'b', label: 'Profile' },
];
</script>

<Carousel items={[{ id: 'a', label: 'One' }, { id: 'b', label: 'Two' }]} {...p(k('carousel/Carousel'))} bind:ref={refs[k('carousel/Carousel')]}>
  {#snippet children(item)}{item.label}{/snippet}
</Carousel>
<ResizablePanelGroup {...p(k('resizable/ResizablePanelGroup'))} bind:ref={refs[k('resizable/ResizablePanelGroup')]}>
  <ResizablePanel id="nav" defaultSize={30} {...p(k('resizable/ResizablePanel'))} bind:ref={refs[k('resizable/ResizablePanel')]}>Nav</ResizablePanel>
  <ResizableHandle {...p(k('resizable/ResizableHandle'))} bind:ref={refs[k('resizable/ResizableHandle')]} />
  <ResizablePanel id="main">Main</ResizablePanel>
</ResizablePanelGroup>
<ScrollArea label="Log" {...p(k('scroll-area/ScrollArea'))} bind:ref={refs[k('scroll-area/ScrollArea')]}><p>Line</p></ScrollArea>
<Sidebar items={[{ label: 'Home', href: 'https://example.com/' }]} {...p(k('sidebar/Sidebar'))} bind:ref={refs[k('sidebar/Sidebar')]} />
<AppNav items={[{ label: 'Home', href: 'https://example.com/' }]} {...p(k('sidebar/AppNav'))} bind:ref={refs[k('sidebar/AppNav')]} />
<Stepper {steps} current={0} {...p(k('stepper/Stepper'))} bind:ref={refs[k('stepper/Stepper')]} />
<Wizard {steps} {...p(k('stepper/Wizard'))} bind:ref={refs[k('stepper/Wizard')]}>
  {#snippet content({ step })}{step.label}{/snippet}
</Wizard>
<Table {...p(k('table/Table'))} bind:ref={refs[k('table/Table')]}>
  <TableCaption {...p(k('table/TableCaption'))} bind:ref={refs[k('table/TableCaption')]}>Invoices</TableCaption>
  <TableHeader {...p(k('table/TableHeader'))} bind:ref={refs[k('table/TableHeader')]}>
    <TableRow><TableHead {...p(k('table/TableHead'))} bind:ref={refs[k('table/TableHead')]}>Invoice</TableHead></TableRow>
  </TableHeader>
  <TableBody {...p(k('table/TableBody'))} bind:ref={refs[k('table/TableBody')]}>
    <TableRow {...p(k('table/TableRow'))} bind:ref={refs[k('table/TableRow')]}>
      <TableCell {...p(k('table/TableCell'))} bind:ref={refs[k('table/TableCell')]}>INV-1</TableCell>
    </TableRow>
    <TableEmpty colspan={1} {...p(k('table/TableEmpty'))} bind:ref={refs[k('table/TableEmpty')]}>None</TableEmpty>
  </TableBody>
  <TableFooter {...p(k('table/TableFooter'))} bind:ref={refs[k('table/TableFooter')]}>
    <TableRow><TableCell>Total</TableCell></TableRow>
  </TableFooter>
</Table>
<Accordion items={[{ value: 'a', title: 'A', content: 'Body' }]} {...p(k('tabs-accordion/Accordion'))} bind:ref={refs[k('tabs-accordion/Accordion')]} />
<Collapsible label="More" {...p(k('tabs-accordion/Collapsible'))} bind:ref={refs[k('tabs-accordion/Collapsible')]}>Body</Collapsible>
<Tabs items={[{ value: 'a', label: 'A' }, { value: 'b', label: 'B' }]} value="a" {...p(k('tabs-accordion/Tabs'))} bind:ref={refs[k('tabs-accordion/Tabs')]}>
  {#snippet content(item)}{item.label}{/snippet}
</Tabs>
<Toggle aria-label="Bold" {...p(k('toggle/Toggle'))} bind:ref={refs[k('toggle/Toggle')]}>B</Toggle>
<ToggleGroup type="single" aria-label="Align" {...p(k('toggle/ToggleGroup'))} bind:ref={refs[k('toggle/ToggleGroup')]}>
  <ToggleGroupItem value="left">L</ToggleGroupItem>
  <ToggleGroupItem value="right" {...p(k('toggle/ToggleGroupItem'))} bind:ref={refs[k('toggle/ToggleGroupItem')]}>R</ToggleGroupItem>
</ToggleGroup>
<Toolbar aria-label="Editor" {...p(k('toolbar/Toolbar'))} bind:ref={refs[k('toolbar/Toolbar')]}>
  <ToolbarGroup type="multiple" aria-label="Style" {...p(k('toolbar/ToolbarGroup'))} bind:ref={refs[k('toolbar/ToolbarGroup')]}>
    <ToolbarGroupItem value="bold">Bold</ToolbarGroupItem>
    <ToolbarGroupItem value="italic" {...p(k('toolbar/ToolbarGroupItem'))} bind:ref={refs[k('toolbar/ToolbarGroupItem')]}>Italic</ToolbarGroupItem>
  </ToolbarGroup>
  <ToolbarSeparator {...p(k('toolbar/ToolbarSeparator'))} bind:ref={refs[k('toolbar/ToolbarSeparator')]} />
  <ToolbarButton {...p(k('toolbar/ToolbarButton'))} bind:ref={refs[k('toolbar/ToolbarButton')]}>Undo</ToolbarButton>
  <ToolbarLink href="https://example.com/help" {...p(k('toolbar/ToolbarLink'))} bind:ref={refs[k('toolbar/ToolbarLink')]}>Help</ToolbarLink>
</Toolbar>
<TreeView items={[{ id: 'a', label: 'Docs' }]} label="Files" {...p(k('tree/TreeView'))} bind:ref={refs[k('tree/TreeView')]} />
