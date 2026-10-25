<script lang="ts">
import { Pagination } from '../../src/components/navigation/index.ts';
</script>

<Pagination.Root page={1} pageCount={3} label="Composed pages">
  {#snippet children()}
    <Pagination.Page page={1} />
    <Pagination.Page page={2}>Second</Pagination.Page>
  {/snippet}
</Pagination.Root>
