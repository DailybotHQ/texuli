<!-- Lazily loaded: carry the styles with the component (Astro attaches lazily
     imported component CSS only to some pages). -->
<svelte:options css="injected" />

<script lang="ts">
/**
 * Badge, Chip, Tag, Kbd, Code and the inline-text catalog node: the instance
 * the props panel drives, then every variant and state side by side.
 */
import { Badge, Chip, Tag } from 'texuli/badge';
import { Button } from 'texuli/button';
import { Code, CopyButton, Kbd } from 'texuli/kbd-code';
import { readers, type StageValues } from './values.ts';

type Props = { componentId: string; values: StageValues };

let { componentId, values }: Props = $props();

const { str, bool, pick } = readers(() => values);

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
  {:else if componentId === 'kbd'}
    <p class="row">Press <Kbd>⌘</Kbd> + <Kbd>K</Kbd> to search, or <Kbd>Esc</Kbd> to close.</p>
    <p class="row"><Kbd>Shift</Kbd> <Kbd>Enter</Kbd> <Kbd>↑</Kbd> <Kbd>↓</Kbd></p>
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
