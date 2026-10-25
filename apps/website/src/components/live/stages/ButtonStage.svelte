<!-- Lazily loaded: carry the styles with the component (Astro attaches lazily
     imported component CSS only to some pages). -->
<svelte:options css="injected" />

<script lang="ts">
/**
 * Button, ButtonGroup and IconButton: the panel-driven instance, then every
 * variant and the disabled and loading states.
 */
import { Button, ButtonGroup, IconButton } from 'texuli/button';
import { readers, type StageValues } from './values.ts';

type Props = { componentId: string; values: StageValues };

let { componentId, values }: Props = $props();

const { str, bool, pick } = readers(() => values);

const VARIANTS = ['default', 'secondary', 'outline', 'ghost', 'destructive', 'link'] as const;
const SIZES = ['sm', 'md', 'lg'] as const;

let saves = $state(0);
let view = $state('list');

async function save(): Promise<void> {
  await new Promise((done) => setTimeout(done, 600));
  saves += 1;
}
</script>

{#snippet dots()}
  <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
    <circle cx="8" cy="3" r="1.5" fill="currentColor"></circle>
    <circle cx="8" cy="8" r="1.5" fill="currentColor"></circle>
    <circle cx="8" cy="13" r="1.5" fill="currentColor"></circle>
  </svg>
{/snippet}

<div class="stage" data-tx-button-stage={componentId}>
  {#if componentId === 'button'}
    <p class="row">
      <Button
        variant={pick('variant', VARIANTS, 'default')}
        size={pick('size', ['sm', 'md', 'lg', 'icon'] as const, 'md')}
        disabled={bool('disabled')}
        loading={bool('loading')}
        loadingLabel={str('loadingLabel', 'Saving')}
        onclick={save}
      >
        Save note
      </Button>
      <span role="status">Saved {saves} {saves === 1 ? 'time' : 'times'}</span>
    </p>
    <p class="row" aria-label="Every button variant">
      {#each VARIANTS as variant (variant)}
        <Button {variant}>{variant}</Button>
      {/each}
    </p>
    <p class="row" aria-label="Sizes and states">
      {#each SIZES as size (size)}
        <Button {size} variant="outline">{size}</Button>
      {/each}
      <Button disabled>Disabled</Button>
      <Button loading loadingLabel="Saving changes">Loading</Button>
    </p>
  {:else if componentId === 'button-group'}
    <ButtonGroup
      label={str('label', 'View mode')}
      orientation={pick('orientation', ['horizontal', 'vertical'] as const, 'horizontal')}
      attached={bool('attached', true)}
    >
      {#each ['list', 'board', 'calendar'] as mode (mode)}
        <Button
          variant={view === mode ? 'default' : 'outline'}
          aria-pressed={view === mode}
          onclick={() => (view = mode)}
        >
          {mode}
        </Button>
      {/each}
    </ButtonGroup>
    <p class="row" role="status">Showing the {view} view.</p>
  {:else}
    <p class="row">
      <IconButton
        label={str('label', 'More actions')}
        variant={pick('variant', VARIANTS, 'ghost')}
        disabled={bool('disabled')}
        loading={bool('loading')}
        onclick={save}
      >
        {@render dots()}
      </IconButton>
      <span role="status">Pressed {saves} {saves === 1 ? 'time' : 'times'}</span>
    </p>
    <p class="row" aria-label="Every icon button variant">
      {#each VARIANTS.filter((v) => v !== 'link') as variant (variant)}
        <IconButton label={`${variant} action`} {variant}>{@render dots()}</IconButton>
      {/each}
    </p>
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
</style>
