<script lang="ts">
/**
 * Mounts one styled component with bind:ref for the FIX-ref table test.
 */
import { Alert, Callout } from '../../src/components/alert/index.ts';
import { Avatar } from '../../src/components/avatar/index.ts';
import { Badge } from '../../src/components/badge/index.ts';
import { Button, IconButton } from '../../src/components/button/index.ts';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '../../src/components/card/index.ts';
import { Checkbox, Switch } from '../../src/components/choice/index.ts';
import { Progress, Skeleton } from '../../src/components/feedback/index.ts';
import { Label } from '../../src/components/field/index.ts';
import { Input, Textarea } from '../../src/components/input/index.ts';
import { Kbd } from '../../src/components/kbd-code/index.ts';
import { Separator } from '../../src/components/separator-aspect/index.ts';

import type { RefKind } from './ref-kind.ts';

let {
  kind,
  ref = $bindable(null as HTMLElement | null),
}: {
  kind: RefKind;
  ref?: HTMLElement | null;
} = $props();
</script>

{#if kind === 'button'}
  <Button bind:ref>Action</Button>
{:else if kind === 'icon-button'}
  <IconButton bind:ref label="Close">×</IconButton>
{:else if kind === 'card'}
  <Card bind:ref><CardContent>Body</CardContent></Card>
{:else if kind === 'card-header'}
  <CardHeader bind:ref>Header</CardHeader>
{:else if kind === 'card-content'}
  <CardContent bind:ref>Content</CardContent>
{:else if kind === 'card-footer'}
  <CardFooter bind:ref>Footer</CardFooter>
{:else if kind === 'card-title'}
  <CardTitle bind:ref>Title</CardTitle>
{:else if kind === 'card-description'}
  <CardDescription bind:ref>Description</CardDescription>
{:else if kind === 'label'}
  <Label bind:ref for="ref-input">Name</Label>
{:else if kind === 'checkbox'}
  <Checkbox bind:ref label="Accept" />
{:else if kind === 'switch'}
  <Switch bind:ref label="Notify" />
{:else if kind === 'input'}
  <Input bind:ref aria-label="Name" value="Ada" />
{:else if kind === 'textarea'}
  <Textarea bind:ref aria-label="Notes" value="Hello" />
{:else if kind === 'badge'}
  <Badge bind:ref>New</Badge>
{:else if kind === 'kbd'}
  <Kbd bind:ref>⌘K</Kbd>
{:else if kind === 'separator'}
  <Separator bind:ref />
{:else if kind === 'progress'}
  <Progress bind:ref value={40} label="Loading" />
{:else if kind === 'skeleton'}
  <Skeleton bind:ref />
{:else if kind === 'avatar'}
  <Avatar bind:ref name="Ada Example" />
{:else if kind === 'alert'}
  <Alert bind:ref title="Heads up" text="Something happened." />
{:else if kind === 'callout'}
  <Callout bind:ref title="Note" text="Read this." />
{/if}
