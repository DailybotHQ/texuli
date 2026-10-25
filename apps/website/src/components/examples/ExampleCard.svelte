<script lang="ts">
import { Badge } from 'texuli/badge';
import type { ExampleCatalogItem } from './catalog.ts';
import ExampleFrame from './ExampleFrame.svelte';
import ExampleIframe from './ExampleIframe.svelte';
import { examplePreviewHref, isFullPageExample } from './full-page.ts';

type Props = {
  item: ExampleCatalogItem;
  detailHref: string;
  /** Site base for preview URLs. */
  base?: string;
  eager?: boolean;
  listing?: boolean;
  headingLevel?: 'h2' | 'none';
};

let {
  item,
  detailHref,
  base = '/',
  eager = false,
  listing = true,
  headingLevel = 'h2',
}: Props = $props();

const fullPage = $derived(isFullPageExample(item.id));
const previewHref = $derived(examplePreviewHref(base, item.id));
/** Frame chrome (toggles + iframe) mounts on demand so listing axe stays tractable. */
let showFrame = $state(eager && !isFullPageExample(item.id));
</script>

<article
  class="card"
  data-example-id={item.id}
  data-package={item.packageId}
  data-kind={item.kind}
  data-full-page={fullPage ? 'true' : 'false'}
>
  <header class="card__head">
    <div class="card__titles">
      {#if headingLevel === 'h2'}
        <h2 class="card__title">
          <a href={detailHref}>{item.title}</a>
        </h2>
      {:else}
        <p class="card__title">
          <a href={detailHref}>{item.title}</a>
        </p>
      {/if}
      <p class="card__id"><code>{item.id}</code> · <code>{item.component}</code></p>
      {#if headingLevel === 'h2'}
        <p class="card__desc">{item.description}</p>
      {/if}
    </div>
    <div class="card__meta">
      <Badge variant="secondary">{item.packageId}</Badge>
      <Badge variant="outline">{item.kind}</Badge>
    </div>
  </header>

  {#if item.props.length > 0}
    <div class="card__props">
      <span class="card__props-label" id={`props-${item.id}`}>Props</span>
      <ul aria-labelledby={`props-${item.id}`}>
        {#each item.props as prop (prop)}
          <li><code>{prop}</code></li>
        {/each}
      </ul>
    </div>
  {/if}

  {#if fullPage}
    <div class="card__fullpage" data-tx-example-fullpage={item.id}>
      <p>
        This is a full-page layout example. It keeps its own landmarks in an isolated preview so it
        does not collide with the site shell.
      </p>
      <a class="card__open" href={examplePreviewHref(base, item.id, { embed: false })}
        >Open the live example</a
      >
    </div>
  {:else if showFrame}
    <ExampleFrame title={item.title} label="Example">
      {#snippet children({ mode, dir })}
        <ExampleIframe
          id={item.id}
          title={item.title}
          {base}
          {mode}
          {dir}
          eager={true}
          height="22rem"
        />
      {/snippet}
    </ExampleFrame>
  {:else}
    <div class="card__idle" data-tx-example-idle={item.id}>
      <p>Live example loads in an isolated same-origin preview frame.</p>
      <button type="button" class="card__open" onclick={() => (showFrame = true)}>
        Load live example
      </button>
    </div>
  {/if}

  {#if listing}
    <p class="card__nosource">
      <a href={detailHref}>Open the detail page</a>
      {#if !fullPage}
        · <a href={examplePreviewHref(base, item.id, { embed: false })}>Open the live example</a>
      {/if}
    </p>
  {:else if item.source}
    <details class="card__source">
      <summary>Source{item.sourcePath ? ` (${item.sourcePath})` : ''}</summary>
      <pre class="card__code"><code>{item.source}</code></pre>
    </details>
  {:else}
    <p class="card__nosource">
      Source path: <code>{item.component}</code>
      · <a href={previewHref}>Isolated preview</a>
    </p>
  {/if}
</article>

<style>
  .card {
    display: grid;
    gap: 0.75rem;
    padding: 1rem;
    border: 1px solid var(--tx-border);
    border-radius: var(--tx-radius, 0.5rem);
    background: var(--tx-surface, var(--tx-background));
    color: var(--tx-foreground);
  }
  .card__head {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem 1rem;
    justify-content: space-between;
  }
  .card__title {
    margin: 0;
    font-size: 1.15rem;
    font-weight: 600;
  }
  .card__title a {
    color: var(--tx-foreground);
    text-decoration: none;
    min-block-size: 1.5rem;
    display: inline-flex;
    align-items: center;
  }
  .card__title a:hover {
    text-decoration: underline;
  }
  .card__id,
  .card__desc,
  .card__nosource {
    margin: 0.25rem 0 0;
    font-size: 0.875rem;
    color: var(--tx-foreground);
  }
  .card__nosource a,
  .card__open {
    color: var(--tx-link, var(--tx-foreground));
    min-block-size: 1.5rem;
    display: inline-flex;
    align-items: center;
  }
  .card__open {
    font-weight: 600;
    margin-block-start: 0.5rem;
  }
  .card__fullpage,
  .card__idle {
    padding: 1rem;
    border: 1px dashed var(--tx-border);
    border-radius: var(--tx-radius, 0.375rem);
    background: var(--tx-muted, var(--tx-background));
  }
  .card__fullpage p,
  .card__idle p {
    margin: 0;
    font-size: 0.9rem;
  }
  .card__idle {
    display: grid;
    gap: 0.75rem;
    justify-items: start;
  }
  button.card__open {
    border: 1px solid var(--tx-border, CanvasText);
    border-radius: var(--tx-radius, 0.375rem);
    background: var(--tx-surface, Canvas);
    color: var(--tx-foreground, CanvasText);
    font: inherit;
    font-weight: 600;
    padding: 0.5rem 1rem;
    cursor: pointer;
  }
  button.card__open:focus-visible {
    outline: 2px solid var(--tx-ring, Highlight);
    outline-offset: 2px;
  }
  .card__meta {
    display: flex;
    flex-wrap: wrap;
    gap: 0.35rem;
    align-items: start;
  }
  .card__props {
    display: flex;
    flex-wrap: wrap;
    gap: 0.35rem 0.75rem;
    align-items: center;
    font-size: 0.8rem;
  }
  .card__props-label {
    font-weight: 600;
  }
  .card__props ul {
    display: flex;
    flex-wrap: wrap;
    gap: 0.35rem;
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .card__source summary {
    cursor: pointer;
    font-weight: 600;
    min-block-size: 1.5rem;
    min-inline-size: 1.5rem;
    display: flex;
    align-items: center;
    padding-block: 0.25rem;
  }
  .card__code {
    margin: 0.5rem 0 0;
    padding: 0.75rem;
    overflow: auto;
    max-block-size: 24rem;
    border-radius: var(--tx-radius, 0.375rem);
    border: 1px solid var(--tx-border);
    background: var(--tx-muted, var(--tx-background));
    color: var(--tx-foreground);
    font-size: 0.75rem;
    line-height: 1.45;
  }
</style>
