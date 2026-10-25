<script lang="ts">
import { Pagination } from '@texuli/primitives/pagination';
</script>

{#snippet navigation({ props }: { props: Record<string, unknown> })}
  <nav {...props} data-composed-pagination></nav>
{/snippet}

<Pagination.Root child={navigation} label="Composed pages" pageCount={4} />
