<script lang="ts">
import { Breadcrumb, Pagination } from 'texuli/navigation';
</script>

<section data-example="ui-navigation-variants" class="demo" aria-label="Navigation variants">
  <h2>Sizes and pagination variants</h2>
  <div class="col">
    <Breadcrumb size="sm" label="Small trail" items={[{ label: 'A', href: 'https://example.com/a' }, { label: 'B' }]} />
    <Breadcrumb size="lg" label="Large trail" items={[{ label: 'Library', href: 'https://example.com/l' }, { label: 'Select' }]} />
  </div>
  <div class="row">
    <Pagination.Root page={1} pageCount={5} size="sm" variant="outline" label="Small pages" />
    <Pagination.Root page={3} pageCount={5} size="md" variant="soft" label="Soft pages" />
    <Pagination.Root page={5} pageCount={5} size="lg" variant="outline" label="Large pages" />
  </div>
</section>

<style>
  .demo {
    display: grid;
    gap: 1.25rem;
    padding: 1.5rem;
    min-block-size: 14rem;
    color: var(--tx-foreground, CanvasText);
    background: var(--tx-background, Canvas);
  }
  h2 {
    margin: 0;
  }
  .col {
    display: grid;
    gap: 0.75rem;
  }
  .row {
    display: flex;
    flex-wrap: wrap;
    gap: 1.25rem;
    align-items: center;
  }
</style>
