<script lang="ts">
import { Pagination } from '../../src/pagination/index.ts';
import type { HarnessProps } from '../support/contract.ts';

let { p, refs }: HarnessProps = $props();
</script>

<Pagination.Root pageCount={10} page={5} {...p('pagination/Root')} bind:ref={refs['pagination/Root']}>
  {#snippet children({ pages })}
    <Pagination.PreviousButton {...p('pagination/PreviousButton')} bind:ref={refs['pagination/PreviousButton']} />
    {#each pages as token (token)}
      {#if token === 'ellipsis-start'}
        <Pagination.Ellipsis {...p('pagination/Ellipsis')} bind:ref={refs['pagination/Ellipsis']} />
      {:else if token === 'ellipsis-end'}
        <Pagination.Ellipsis />
      {:else if token === 6}
        <Pagination.Page page={token} {...p('pagination/Page')} bind:ref={refs['pagination/Page']} />
      {:else}
        <Pagination.Page page={token} />
      {/if}
    {/each}
    <Pagination.NextButton {...p('pagination/NextButton')} bind:ref={refs['pagination/NextButton']} />
  {/snippet}
</Pagination.Root>
