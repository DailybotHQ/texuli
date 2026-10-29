<script lang="ts">
import type { HarnessProps } from '../../../primitives/tests/support/contract.ts';
import {
  Alert,
  AlertSurface,
  Banner,
  Callout,
  ToneIcon,
} from '../../src/components/alert/index.ts';
import { Avatar, AvatarGroup } from '../../src/components/avatar/index.ts';
import { Badge, Chip, Tag } from '../../src/components/badge/index.ts';
import { Button, ButtonGroup, IconButton } from '../../src/components/button/index.ts';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardGrid,
  CardHeader,
  CardMedia,
  CardTitle,
} from '../../src/components/card/index.ts';
import { EmptyState, ErrorState } from '../../src/components/empty/index.ts';
import { Progress, Skeleton, Spinner } from '../../src/components/feedback/index.ts';
import { Icon } from '../../src/components/icons/index.ts';
import { LucideIcon } from '../../src/components/icons/lucide.ts';
import { Code, CopyButton, Kbd } from '../../src/components/kbd-code/index.ts';
import { Rating } from '../../src/components/rating/index.ts';
import {
  AspectRatio,
  Separator,
  VisuallyHidden,
} from '../../src/components/separator-aspect/index.ts';
import { Kpi, KpiRow, Stat } from '../../src/components/stat/index.ts';
import { Timeline, TimelineItem } from '../../src/components/timeline/index.ts';
import CustomIcon from '../fixtures/CustomIcon.svelte';

let { p, refs }: HarnessProps = $props();
const k = (name: string) => `components/${name}`;
</script>

<Alert title="Heads up" text="Saved." {...p(k('alert/Alert'))} bind:ref={refs[k('alert/Alert')]} />
<AlertSurface {...p(k('alert/AlertSurface'))} bind:ref={refs[k('alert/AlertSurface')]}>Body</AlertSurface>
<Banner text="Maintenance tonight." {...p(k('alert/Banner'))} bind:ref={refs[k('alert/Banner')]} />
<Callout title="Note" text="Read this." {...p(k('alert/Callout'))} bind:ref={refs[k('alert/Callout')]} />
<ToneIcon tone="success" {...p(k('alert/ToneIcon'))} bind:ref={refs[k('alert/ToneIcon')]} />
<Avatar name="Ada Example" {...p(k('avatar/Avatar'))} bind:ref={refs[k('avatar/Avatar')]} />
<AvatarGroup items={[{ name: 'Ada Example' }, { name: 'Lin Example' }]} {...p(k('avatar/AvatarGroup'))} bind:ref={refs[k('avatar/AvatarGroup')]} />
<Badge {...p(k('badge/Badge'))} bind:ref={refs[k('badge/Badge')]}>New</Badge>
<Chip label="Design" {...p(k('badge/Chip'))} bind:ref={refs[k('badge/Chip')]} />
<Tag label="Draft" {...p(k('badge/Tag'))} bind:ref={refs[k('badge/Tag')]} />
<Button {...p(k('button/Button'))} bind:ref={refs[k('button/Button')]}>Save</Button>
<ButtonGroup aria-label="Actions" {...p(k('button/ButtonGroup'))} bind:ref={refs[k('button/ButtonGroup')]}><Button>One</Button></ButtonGroup>
<IconButton label="Close" {...p(k('button/IconButton'))} bind:ref={refs[k('button/IconButton')]}>×</IconButton>
<CardGrid {...p(k('card/CardGrid'))} bind:ref={refs[k('card/CardGrid')]}>
  <Card {...p(k('card/Card'))} bind:ref={refs[k('card/Card')]}>
    <CardMedia src="https://example.com/a.png" alt="" {...p(k('card/CardMedia'))} bind:ref={refs[k('card/CardMedia')]} />
    <CardHeader {...p(k('card/CardHeader'))} bind:ref={refs[k('card/CardHeader')]}>
      <CardTitle {...p(k('card/CardTitle'))} bind:ref={refs[k('card/CardTitle')]}>Title</CardTitle>
      <CardDescription {...p(k('card/CardDescription'))} bind:ref={refs[k('card/CardDescription')]}>Text</CardDescription>
    </CardHeader>
    <CardContent {...p(k('card/CardContent'))} bind:ref={refs[k('card/CardContent')]}>Body</CardContent>
    <CardFooter {...p(k('card/CardFooter'))} bind:ref={refs[k('card/CardFooter')]}>Foot</CardFooter>
  </Card>
</CardGrid>
<EmptyState title="Nothing yet" {...p(k('empty/EmptyState'))} bind:ref={refs[k('empty/EmptyState')]} />
<ErrorState {...p(k('empty/ErrorState'))} bind:ref={refs[k('empty/ErrorState')]} />
<Progress value={40} label="Upload" {...p(k('feedback/Progress'))} bind:ref={refs[k('feedback/Progress')]} />
<Skeleton {...p(k('feedback/Skeleton'))} bind:ref={refs[k('feedback/Skeleton')]} />
<Spinner {...p(k('feedback/Spinner'))} bind:ref={refs[k('feedback/Spinner')]} />
<Icon icon="close" {...p(k('icons/Icon'))} bind:ref={refs[k('icons/Icon')]} />
<LucideIcon icon={CustomIcon} {...p(k('icons/LucideIcon'))} bind:ref={refs[k('icons/LucideIcon')]} />
<Code {...p(k('kbd-code/Code'))} bind:ref={refs[k('kbd-code/Code')]}>npm i</Code>
<CopyButton value="npm i" {...p(k('kbd-code/CopyButton'))} bind:ref={refs[k('kbd-code/CopyButton')]} />
<Kbd {...p(k('kbd-code/Kbd'))} bind:ref={refs[k('kbd-code/Kbd')]}>⌘K</Kbd>
<Rating value={3} {...p(k('rating/Rating'))} bind:ref={refs[k('rating/Rating')]} />
<AspectRatio {...p(k('separator-aspect/AspectRatio'))} bind:ref={refs[k('separator-aspect/AspectRatio')]}>Media</AspectRatio>
<Separator {...p(k('separator-aspect/Separator'))} bind:ref={refs[k('separator-aspect/Separator')]} />
<VisuallyHidden {...p(k('separator-aspect/VisuallyHidden'))} bind:ref={refs[k('separator-aspect/VisuallyHidden')]}>Hidden</VisuallyHidden>
<KpiRow label="Metrics" {...p(k('stat/KpiRow'))} bind:ref={refs[k('stat/KpiRow')]}>
  <Kpi label="Users" value={12} {...p(k('stat/Kpi'))} bind:ref={refs[k('stat/Kpi')]} />
</KpiRow>
<Stat label="Revenue" value="$1" {...p(k('stat/Stat'))} bind:ref={refs[k('stat/Stat')]} />
<Timeline {...p(k('timeline/Timeline'))} bind:ref={refs[k('timeline/Timeline')]}>
  <TimelineItem title="Created" {...p(k('timeline/TimelineItem'))} bind:ref={refs[k('timeline/TimelineItem')]} />
</Timeline>
