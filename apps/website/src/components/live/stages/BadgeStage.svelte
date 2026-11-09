<!-- Lazily loaded: carry the styles with the component (Astro attaches lazily
     imported component CSS only to some pages). -->
<svelte:options css="injected" />

<script lang="ts">
/**
 * Badge, Chip, Tag, Kbd, Code, the avatar grid, the inline-text catalog
 * node, and the typography and surface components (Heading, Text, Prose, Box): the instance the props panel drives, then every variant and state
 * side by side.
 */

import { AvatarGroupGrid } from 'texuli/avatar';
import { Badge, Chip, Tag } from 'texuli/badge';
import { Button } from 'texuli/button';
import { Code, CopyButton, Kbd } from 'texuli/kbd-code';
import { Box, Heading, Prose, Text } from 'texuli/typography';
import { readers, type StageValues } from './values.ts';

type Props = { componentId: string; values: StageValues };

let { componentId, values }: Props = $props();

const { str, num, bool, pick } = readers(() => values);

const VARIANTS = [
  'default',
  'secondary',
  'outline',
  'success',
  'warning',
  'destructive',
  'info',
  'neutral',
] as const;

const CREW = [
  { name: 'Ada Example' },
  { name: 'Grace Sample' },
  { name: 'Linus Demo' },
  { name: 'Mina Placeholder' },
  { name: 'Omar Fixture' },
];
const SIZES = ['xs', 'sm', 'md', 'lg'] as const;

let selected = $state(true);
let tags = $state(['Design', 'Research', 'Logistics']);

$effect(() => {
  selected = bool('selected', true);
});
</script>

<div class="stage" data-tx-badge-stage={componentId}>
  {#if componentId === 'badge'}
    <p class="row"><Badge variant={pick('variant', VARIANTS, 'default')}>Shipped</Badge></p>
    <p class="row" aria-label="Every badge variant">
      {#each VARIANTS as variant (variant)}
        <Badge {variant}>{variant}</Badge>
      {/each}
    </p>
  {:else if componentId === 'chip'}
    <p class="row">
      <Chip
        label={str('label', 'Active')}
        variant={pick('variant', VARIANTS, 'outline')}
        {selected}
        disabled={bool('disabled')}
        onclick={() => (selected = !selected)}
      />
    </p>
    <p class="row" aria-label="Chip states">
      <Chip label="Unread only" />
      <Chip label="Selected" selected />
      <Chip label="Disabled" disabled />
    </p>
  {:else if componentId === 'tag'}
    <p class="row">
      {#each tags as tag (tag)}
        <Tag
          label={tag === 'Logistics' ? str('label', tag) : tag}
          variant={pick('variant', VARIANTS, 'secondary')}
          disabled={bool('disabled')}
          removeLabel={`${str('removeLabel', 'Remove')} ${tag}`}
          onRemove={() => (tags = tags.filter((t) => t !== tag))}
        />
      {/each}
      {#if tags.length === 0}
        <button type="button" class="reset" onclick={() => (tags = ['Design', 'Research', 'Logistics'])}>
          Restore tags
        </button>
      {/if}
    </p>
    <p class="row" aria-label="Every tag variant">
      {#each VARIANTS as variant (variant)}
        <Tag label={variant} {variant} />
      {/each}
    </p>
  {:else if componentId === 'avatar-group-grid'}
    <p class="row" aria-label="Two, three, four and more members">
      {#each [2, 3, 4, 5] as count (count)}
        <AvatarGroupGrid
          items={CREW.slice(0, count)}
          size={pick('size', SIZES, 'md')}
          label={count === 3 ? str('label', '#launch') : undefined}
        />
      {/each}
    </p>
  {:else if componentId === 'kbd'}
    <p class="row">Press <Kbd>⌘</Kbd> + <Kbd>K</Kbd> to search, or <Kbd>Esc</Kbd> to close.</p>
    <p class="row"><Kbd>Shift</Kbd> <Kbd>Enter</Kbd> <Kbd>↑</Kbd> <Kbd>↓</Kbd></p>
  {:else if componentId === 'heading'}
    {@const level = Math.min(6, Math.max(1, Math.round(num('level', 2)))) as 1 | 2 | 3 | 4 | 5 | 6}
    <Heading
      {level}
      size={pick('size', ['display', 'xl', 'lg', 'md', 'sm'] as const, 'lg')}
      tone={pick('tone', ['default', 'muted'] as const, 'default')}
      truncate={bool('truncate', false)}
      label={str('label', 'Quarterly report')}
    />
    <div class="column" aria-label="Every heading size at level 3">
      {#each ['display', 'xl', 'lg', 'md', 'sm'] as const as size (size)}
        <Heading level={3} {size} label={`Size ${size}`} />
      {/each}
    </div>
  {:else if componentId === 'text'}
    <Text
      size={pick('size', ['figure', 'lg', 'md', 'sm', 'xs'] as const, 'md')}
      tone={pick('tone', ['default', 'muted', 'subtle', 'primary', 'success', 'warning', 'destructive', 'info'] as const, 'default')}
      weight={pick('weight', ['regular', 'medium', 'semibold'] as const, 'regular')}
      transform={pick('transform', ['none', 'uppercase', 'lowercase', 'capitalize'] as const, 'none')}
      tracking={pick('tracking', ['normal', 'wide'] as const, 'normal')}
      tabular={bool('tabular', false)}
      mono={bool('mono', false)}
      label={str('label', 'Updated an hour ago')}
    />
    <div class="column" aria-label="An eyebrow, a figure and every tone">
      <Text size="xs" tone="muted" transform="uppercase" tracking="wide">Revenue</Text>
      <Text size="figure" tabular weight="semibold">$1,284,300</Text>
      {#each ['muted', 'subtle', 'primary', 'success', 'warning', 'destructive', 'info'] as const as tone (tone)}
        <Text size="sm" {tone}>{tone}</Text>
      {/each}
    </div>
  {:else if componentId === 'prose'}
    <Prose size={pick('size', ['md', 'lg'] as const, 'md')}>
      <p>Example Co. closed the quarter ahead of plan.</p>
      <h3>What changed</h3>
      <ul>
        <li>Reports load from a cached query.</li>
        <li>Teams share dashboards with read-only links.</li>
      </ul>
    </Prose>
  {:else if componentId === 'box'}
    <Box
      padding={pick('padding', ['none', 'sm', 'md', 'lg', 'xl'] as const, 'md')}
      radius={pick('radius', ['none', 'sm', 'md', 'lg', 'xl', 'full'] as const, 'md')}
      border={pick('border', ['none', 'default', 'strong', 'block-start', 'block-end'] as const, 'default')}
      elevation={pick('elevation', ['none', 'sm', 'md', 'lg'] as const, 'none')}
      surface={pick('surface', ['transparent', 'default', 'muted', 'subtle', 'elevated'] as const, 'default')}
    >
      <Text size="sm">A panel from tokens.</Text>
    </Box>
  {:else if componentId === 'inline-text'}
    {@const text = str('text', 'Save changes')}
    <p class="row"><Button>{text}</Button></p>
    <p class="row" aria-label="The same text run in other slot-only components">
      <Badge variant="outline">{text}</Badge>
      <Chip label={text} />
      <Kbd>{text}</Kbd>
    </p>
  {:else}
    {@const code = str('value', 'const n = 1;')}
    {#if pick('variant', ['inline', 'block'] as const, 'inline') === 'block'}
      <Code variant="block" language={str('language', 'ts')} value={code} />
    {:else}
      <p class="row">Run <Code value={code} /> in the console.</p>
    {/if}
    <div class="row">
      <CopyButton value={code} size="sm" label="Copy code" copiedLabel="Code copied" />
    </div>
  {/if}
</div>

<style>
  .stage {
    display: grid;
    gap: 0.75rem;
  }
  .row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.5rem;
    margin: 0;
  }
  .column {
    display: grid;
    gap: 0.25rem;
  }
  .reset {
    min-block-size: 2rem;
    padding-inline: 0.75rem;
    border: 1px solid var(--tx-border, ButtonBorder);
    border-radius: var(--tx-radius, 0.375rem);
    background: var(--tx-background, Canvas);
    color: var(--tx-foreground, CanvasText);
    font: inherit;
  }
</style>
