<script lang="ts">
import { Pagination } from '@texuli/primitives/pagination';

let page = $state(5);
</script>

<Pagination.Root bind:page pageCount={40} siblings={1} boundaries={1} label="Search result pages">
  {#snippet children({ pages })}
    <ul>
      <li><Pagination.PreviousButton>Previous</Pagination.PreviousButton></li>
      {#each pages as token (token)}
        <li>
          {#if typeof token === 'number'}
            <Pagination.Page page={token}>{token}</Pagination.Page>
          {:else}
            <Pagination.Ellipsis />
          {/if}
        </li>
      {/each}
      <li><Pagination.NextButton>Next</Pagination.NextButton></li>
    </ul>
  {/snippet}
</Pagination.Root>
