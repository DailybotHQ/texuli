<script lang="ts">
import type { Snippet } from 'svelte';
import { Badge } from 'texuli/badge';
import { Breadcrumb } from 'texuli/navigation';

type Props = {
  title: string;
  description: string;
  children?: Snippet;
};

let { title, description, children }: Props = $props();

const crumbs = $derived([{ label: 'Showcase', href: '/showcase/' }, { label: title }]);
</script>

<div class="showcase-chrome" data-tx-showcase>
  <header class="showcase-chrome__header">
    <Breadcrumb items={crumbs} label="Showcase breadcrumb" size="sm" />
    <div class="showcase-chrome__title-row">
      <h1>{title}</h1>
      <Badge variant="secondary">Static demo</Badge>
    </div>
    <p class="showcase-chrome__lead">{description}</p>
    <p class="showcase-chrome__note">
      Built only with Texuli components and tokens. Fictional Harbor Notes data — no runtime network.
    </p>
  </header>
  <div class="showcase-chrome__body">
    {@render children?.()}
  </div>
</div>

<style>
  .showcase-chrome {
    display: grid;
    gap: 1.5rem;
  }
  .showcase-chrome__header {
    display: grid;
    gap: 0.5rem;
  }
  .showcase-chrome__title-row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.75rem;
  }
  h1 {
    margin: 0;
    font-size: clamp(1.75rem, 4vw, 2.25rem);
    line-height: 1.2;
  }
  .showcase-chrome__lead {
    margin: 0;
    color: var(--tx-muted-foreground, GrayText);
    font-size: 1.05rem;
  }
  .showcase-chrome__note {
    margin: 0;
    font-size: 0.875rem;
    color: var(--tx-muted-foreground, GrayText);
  }
  .showcase-chrome__body {
    min-inline-size: 0;
  }
</style>
